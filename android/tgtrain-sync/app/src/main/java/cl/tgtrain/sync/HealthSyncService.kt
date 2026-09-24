package cl.tgtrain.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale
import kotlin.reflect.KClass
import kotlinx.coroutines.tasks.await

/** Health Connect is read-only here. Nothing is inserted into the training log. */
class HealthSyncService(private val context: Context) {
    private val client get() = HealthConnectClient.getOrCreate(context)
    private val zone get() = ZoneId.systemDefault()

    val backgroundReadAvailable: Boolean
        get() = client.features.getFeatureStatus(
            HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND
        ) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    val requestedPermissions: Set<String>
        get() = allPermissions + if (backgroundReadAvailable)
            setOf(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND) else emptySet()

    companion object {
        val essentialPermissions = setOf(
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(StepsRecord::class),
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(SleepSessionRecord::class),
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(ExerciseSessionRecord::class)
        )
        val optionalPermissions = setOf(
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(DistanceRecord::class),
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(HeartRateRecord::class)
        )
        val allPermissions = essentialPermissions + optionalPermissions
    }

    suspend fun grantedPermissions(): Set<String> = client.permissionController.getGrantedPermissions()

    suspend fun availableSources(): List<String> {
        val end = Instant.now()
        val start = end.minus(Duration.ofDays(29))
        val origins = linkedSetOf<String>()
        // Read a bounded sample of each type to discover the actual package Mi Fitness uses.
        origins += readAll(StepsRecord::class, start, end, limitPages = 2)
            .map { it.metadata.dataOrigin.packageName }
        origins += readAll(SleepSessionRecord::class, start, end, limitPages = 2)
            .map { it.metadata.dataOrigin.packageName }
        origins += readAll(ExerciseSessionRecord::class, start, end, limitPages = 2)
            .map { it.metadata.dataOrigin.packageName }
        return origins.filter { it.isNotBlank() }.sortedWith(
            compareByDescending<String> { it.contains("xiaomi", true) || it.contains("mifitness", true) }
                .thenBy { it }
        )
    }

    suspend fun sync(sourcePackage: String, days: Int = 14): SyncReport {
        require(sourcePackage.isNotBlank()) { "Elige la fuente Mi Fitness antes de sincronizar." }
        require(days in 1..14) { "El período de sincronización debe estar entre 1 y 14 días." }
        val uid = FirebaseAuth.getInstance().currentUser?.uid
            ?: error("Inicia sesión con la misma cuenta de Google que usas en TGTrain.")
        val granted = grantedPermissions()
        check(granted.containsAll(essentialPermissions)) { "Faltan permisos de pasos, sueño o ejercicio." }

        val today = LocalDate.now(zone)
        val firstDay = today.minusDays((days - 1).toLong())
        val start = firstDay.atStartOfDay(zone).toInstant()
        val end = today.plusDays(1).atStartOfDay(zone).toInstant()
        val origin = setOf(DataOrigin(sourcePackage))
        val sleep = readAll(SleepSessionRecord::class, start, end, origin)
        val workouts = readAll(ExerciseSessionRecord::class, start, end, origin)
        val sleepByDay = sleep.groupBy { it.endTime.atZone(zone).toLocalDate() }
        val firestore = FirebaseFirestore.getInstance()
        val batch = firestore.batch()
        val syncedAt = Instant.now().toString()
        val heartRateGranted = granted.contains(androidx.health.connect.client.permission.HealthPermission.getReadPermission(HeartRateRecord::class))
        var sessionsWithHeartRate = 0
        var heartRateSamples = 0

        for (offset in 0 until days) {
            val day = firstDay.plusDays(offset.toLong())
            val dayStart = day.atStartOfDay(zone).toInstant()
            val dayEnd = day.plusDays(1).atStartOfDay(zone).toInstant()
            val steps = client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(dayStart, dayEnd),
                    dataOriginFilter = origin
                )
            )[StepsRecord.COUNT_TOTAL] ?: 0L
            val night = sleepByDay[day].orEmpty()
            val dayData = hashMapOf<String, Any>(
                "dateISO" to day.toString(),
                "steps" to steps,
                "sleepMinutes" to 0L,
                "sleepStart" to "",
                "sleepEnd" to "",
                "sleepSessions" to 0,
                "source" to "health_connect",
                "originPackage" to sourcePackage,
                "syncedAt" to syncedAt
            )
            if (night.isNotEmpty()) {
                dayData["sleepMinutes"] = night.sumOf {
                    Duration.between(it.startTime, it.endTime).toMinutes().coerceAtLeast(0)
                }
                dayData["sleepStart"] = night.minOf { it.startTime }.toString()
                dayData["sleepEnd"] = night.maxOf { it.endTime }.toString()
                dayData["sleepSessions"] = night.size
            }
            batch.set(
                firestore.collection("users").document(uid).collection("wearableDays")
                    .document(day.toString()),
                dayData,
                SetOptions.merge()
            )
        }

        for (workout in workouts) {
            if (!workout.endTime.isAfter(workout.startTime)) continue
            val externalId = stableId(sourcePackage, workout.metadata.id)
            val details = hashMapOf<String, Any?>(
                "id" to externalId,
                "dateISO" to workout.startTime.atZone(zone).toLocalDate().toString(),
                "startTime" to workout.startTime.toString(),
                "endTime" to workout.endTime.toString(),
                "durationSeconds" to Duration.between(workout.startTime, workout.endTime).seconds,
                "exerciseType" to workout.exerciseType,
                "title" to exerciseTitle(workout.exerciseType),
                "distanceMeters" to null,
                "caloriesKcal" to null,
                "heartRateSampleCount" to null,
                "heartRateAvgBpm" to null,
                "heartRateMaxBpm" to null,
                "heartRateMinBpm" to null,
                "source" to "health_connect",
                "originPackage" to sourcePackage,
                "syncedAt" to syncedAt
            )
            if (granted.contains(androidx.health.connect.client.permission.HealthPermission.getReadPermission(DistanceRecord::class))) {
                val distance: AggregationResult = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(workout.startTime, workout.endTime),
                        dataOriginFilter = origin
                    )
                )
                distance[DistanceRecord.DISTANCE_TOTAL]?.let { details["distanceMeters"] = it.inMeters }
            }
            if (granted.contains(androidx.health.connect.client.permission.HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class))) {
                val calories: AggregationResult = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(workout.startTime, workout.endTime),
                        dataOriginFilter = origin
                    )
                )
                calories[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { details["caloriesKcal"] = it.inKilocalories }
            }
            if (heartRateGranted) {
                val samples = readAll(HeartRateRecord::class, workout.startTime, workout.endTime, origin)
                    .flatMap { it.samples }
                    .filter { !it.time.isBefore(workout.startTime) && it.time.isBefore(workout.endTime) }
                details["heartRateSampleCount"] = samples.size
                if (samples.isNotEmpty()) {
                    sessionsWithHeartRate++
                    heartRateSamples += samples.size
                    details["heartRateAvgBpm"] = samples.map { it.beatsPerMinute }.average()
                    details["heartRateMaxBpm"] = samples.maxOf { it.beatsPerMinute }
                    details["heartRateMinBpm"] = samples.minOf { it.beatsPerMinute }
                }
            }
            batch.set(
                firestore.collection("users").document(uid).collection("wearableSessions")
                    .document(externalId),
                details,
                SetOptions.merge()
            )
        }
        batch.commit().await()
        return SyncReport(days, sleep.size, workouts.size, sessionsWithHeartRate, heartRateSamples, heartRateGranted, syncedAt)
    }

    private suspend fun <T : Record> readAll(
        type: KClass<T>,
        start: Instant,
        end: Instant,
        origins: Set<DataOrigin> = emptySet(),
        limitPages: Int = 20
    ): List<T> {
        val result = mutableListOf<T>()
        var token: String? = null
        var pages = 0
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = type,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    dataOriginFilter = origins,
                    pageToken = token,
                    pageSize = 1000
                )
            )
            result += response.records
            token = response.pageToken?.takeIf { it.isNotBlank() }
            pages++
        } while (token != null && pages < limitPages)
        return result
    }

    private fun stableId(origin: String, recordId: String): String {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest("$origin|$recordId".toByteArray(Charsets.UTF_8))
        return bytes.take(16).joinToString("") { String.format(Locale.ROOT, "%02x", it.toInt() and 0xff) }
    }

    private fun exerciseTitle(type: Int) = when (type) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "Trote"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Caminata"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "Trekking"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "Bicicleta"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "Bicicleta estática"
        ExerciseSessionRecord.EXERCISE_TYPE_TENNIS -> "Tenis"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
        ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "Entrenamiento físico"
        else -> "Entrenamiento detectado"
    }
}

data class SyncReport(
    val days: Int,
    val sleepSessions: Int,
    val workouts: Int,
    val sessionsWithHeartRate: Int,
    val heartRateSamples: Int,
    val heartRateGranted: Boolean,
    val syncedAt: String
)
