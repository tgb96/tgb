package cl.tgtrain.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
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
import kotlin.math.abs
import java.util.Locale
import kotlin.reflect.KClass
import kotlinx.coroutines.tasks.await

/** Health Connect is read-only here. Nothing is inserted into the training log. */
class HealthSyncService(private val context: Context) {
    private val client get() = HealthConnectClient.getOrCreate(context)
    // TGTrain belongs to a user in Chile. A fixed regional zone keeps the
    // calendar aligned with Chilean DST even if Android was left on a fixed
    // GMT offset after a clock change.
    private val zone = ZoneId.of("America/Santiago")

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
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(HeartRateRecord::class),
            androidx.health.connect.client.permission.HealthPermission.getReadPermission(OxygenSaturationRecord::class)
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
        // Mi Fitness may publish sleep under a different Xiaomi package than steps.
        // For each night choose one origin, so duplicate providers cannot double the duration.
        val sleepCandidates = readAll(SleepSessionRecord::class, start, end).filter { record ->
            val packageName = record.metadata.dataOrigin.packageName
            packageName == sourcePackage || (isMiFitnessSource(sourcePackage) && isMiFitnessSource(packageName))
        }
        // ExerciseSessionRecord can arrive under a different Health Connect
        // origin than steps or sleep, even when all data came from Mi Fitness.
        // Read the sessions independently and keep the real origin of each one.
        // If another app mirrored the same workout, prefer the selected source
        // (or Mi Fitness) so TGTrain does not offer a duplicate link.
        val workoutRecords = readAll(ExerciseSessionRecord::class, start, end)
        val workouts = workoutRecords
            .groupBy { "${it.startTime}|${it.endTime}|${it.exerciseType}" }
            .values
            .map { copies ->
                copies.firstOrNull { it.metadata.dataOrigin.packageName == sourcePackage }
                    ?: copies.firstOrNull { isMiFitnessSource(it.metadata.dataOrigin.packageName) }
                    ?: copies.first()
            }
        val normalizedWorkouts = workouts.map { workout -> workout to normalizedWorkoutTime(workout) }
        val normalizedSleep = sleepCandidates.map { session -> session to normalizedSleepTime(session) }
        val sleepByDay = normalizedSleep.groupBy { (_, time) -> time.end.atZone(zone).toLocalDate() }
            .mapValues { (_, records) ->
                records.groupBy { (session, _) -> session.metadata.dataOrigin.packageName }.values.maxBy { sourceRecords ->
                    sourceRecords.sumOf { (session, _) ->
                        Duration.between(session.startTime, session.endTime).seconds.coerceAtLeast(0)
                    }
                }
            }
        val sleep = sleepByDay.values.flatten()
        val firestore = FirebaseFirestore.getInstance()
        val batch = firestore.batch()
        val syncedAt = Instant.now().toString()
        val heartRateGranted = granted.contains(androidx.health.connect.client.permission.HealthPermission.getReadPermission(HeartRateRecord::class))
        var sessionsWithHeartRate = 0
        var heartRateSamples = 0
        var sleepSessionsWithStages = 0

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
            val dayData = hashMapOf<String, Any?>(
                "dateISO" to day.toString(),
                "steps" to steps,
                "sleepMinutes" to null,
                "sleepStart" to null,
                "sleepEnd" to null,
                "sleepSessions" to 0,
                "sleepOriginPackage" to null,
                "sleepStageCount" to 0,
                "sleepStagesAvailable" to false,
                "sleepStagesMinutes" to null,
                "sleepRawStart" to null,
                "sleepRawEnd" to null,
                "sleepClockAdjusted" to false,
                "sleepClockAdjustmentMinutes" to 0,
                "sleepClockAdjustmentReason" to null,
                "sleepHeartRateSampleCount" to 0,
                "sleepHeartRateAvgBpm" to null,
                "sleepHeartRateMinBpm" to null,
                "sleepHeartRateMaxBpm" to null,
                "sleepOxygenSampleCount" to 0,
                "sleepOxygenAvgPercent" to null,
                "sleepOxygenMinPercent" to null,
                "sleepOxygenMaxPercent" to null,
                "source" to "health_connect",
                "originPackage" to sourcePackage,
                "syncedAt" to syncedAt
            )
            if (night.isNotEmpty()) {
                val sessions = night.map { (session, _) -> session }
                val times = night.map { (_, time) -> time }
                val stages = sessions.flatMap { it.stages }
                val stageMinutes = stages.groupingBy { sleepStageKey(it.stage) }.fold(0L) { total, stage ->
                    total + Duration.between(stage.startTime, stage.endTime).toMinutes().coerceAtLeast(0)
                }
                dayData["sleepMinutes"] = sessions.sumOf {
                    Duration.between(it.startTime, it.endTime).toMinutes().coerceAtLeast(0)
                }
                dayData["sleepStart"] = times.minOf { it.start }.toString()
                dayData["sleepEnd"] = times.maxOf { it.end }.toString()
                dayData["sleepRawStart"] = sessions.minOf { it.startTime }.toString()
                dayData["sleepRawEnd"] = sessions.maxOf { it.endTime }.toString()
                dayData["sleepSessions"] = sessions.size
                dayData["sleepOriginPackage"] = sessions.first().metadata.dataOrigin.packageName
                dayData["sleepStageCount"] = stages.size
                dayData["sleepStagesAvailable"] = stages.isNotEmpty()
                val clockAdjustment = times.firstOrNull { it.adjustmentMinutes != 0 }
                dayData["sleepClockAdjusted"] = clockAdjustment != null
                dayData["sleepClockAdjustmentMinutes"] = clockAdjustment?.adjustmentMinutes ?: 0
                dayData["sleepClockAdjustmentReason"] = clockAdjustment?.reason
                if (stages.isNotEmpty()) {
                    sleepSessionsWithStages += sessions.count { it.stages.isNotEmpty() }
                    dayData["sleepStagesMinutes"] = stageMinutes
                }
                // Related biometric samples remain on Health Connect's raw timeline.
                // Only the wall-clock labels shown by TGTrain are corrected.
                val sleepStart = sessions.minOf { it.startTime }
                val sleepEnd = sessions.maxOf { it.endTime }
                val sleepOrigins = sessions.map { DataOrigin(it.metadata.dataOrigin.packageName) }.toSet()
                if (heartRateGranted) {
                    val samples = readAll(HeartRateRecord::class, sleepStart, sleepEnd, sleepOrigins)
                        .flatMap { it.samples }
                        .filter { !it.time.isBefore(sleepStart) && it.time.isBefore(sleepEnd) }
                    dayData["sleepHeartRateSampleCount"] = samples.size
                    if (samples.isNotEmpty()) {
                        dayData["sleepHeartRateAvgBpm"] = samples.map { it.beatsPerMinute }.average()
                        dayData["sleepHeartRateMinBpm"] = samples.minOf { it.beatsPerMinute }
                        dayData["sleepHeartRateMaxBpm"] = samples.maxOf { it.beatsPerMinute }
                    }
                }
                if (granted.contains(HealthPermission.getReadPermission(OxygenSaturationRecord::class))) {
                    val oxygen = readAll(OxygenSaturationRecord::class, sleepStart, sleepEnd, sleepOrigins)
                        .filter { !it.time.isBefore(sleepStart) && it.time.isBefore(sleepEnd) }
                        .map { it.percentage.value }
                    dayData["sleepOxygenSampleCount"] = oxygen.size
                    if (oxygen.isNotEmpty()) {
                        dayData["sleepOxygenAvgPercent"] = oxygen.average()
                        dayData["sleepOxygenMinPercent"] = oxygen.min()
                        dayData["sleepOxygenMaxPercent"] = oxygen.max()
                    }
                }
            }
            batch.set(
                firestore.collection("users").document(uid).collection("wearableDays")
                    .document(day.toString()),
                dayData,
                SetOptions.merge()
            )
        }

        for ((workout, normalizedTime) in normalizedWorkouts) {
            if (!workout.endTime.isAfter(workout.startTime)) continue
            val workoutPackage = workout.metadata.dataOrigin.packageName
            val workoutOrigin = setOf(DataOrigin(workoutPackage))
            val externalId = stableId(workoutPackage, workout.metadata.id)
            val details = hashMapOf<String, Any?>(
                "id" to externalId,
                "dateISO" to normalizedTime.start.atZone(zone).toLocalDate().toString(),
                "startTime" to normalizedTime.start.toString(),
                "endTime" to normalizedTime.end.toString(),
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
                "originPackage" to workoutPackage,
                "rawStartTime" to workout.startTime.toString(),
                "rawEndTime" to workout.endTime.toString(),
                "recordedStartZoneOffset" to workout.startZoneOffset?.toString(),
                "recordedEndZoneOffset" to workout.endZoneOffset?.toString(),
                "clockAdjustmentMinutes" to normalizedTime.adjustmentMinutes,
                "clockAdjustmentReason" to normalizedTime.reason,
                "syncedAt" to syncedAt
            )
            if (granted.contains(androidx.health.connect.client.permission.HealthPermission.getReadPermission(DistanceRecord::class))) {
                val distance: AggregationResult = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(DistanceRecord.DISTANCE_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(workout.startTime, workout.endTime),
                        dataOriginFilter = workoutOrigin
                    )
                )
                distance[DistanceRecord.DISTANCE_TOTAL]?.let { details["distanceMeters"] = it.inMeters }
            }
            if (granted.contains(androidx.health.connect.client.permission.HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class))) {
                val calories: AggregationResult = client.aggregate(
                    AggregateRequest(
                        metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(workout.startTime, workout.endTime),
                        dataOriginFilter = workoutOrigin
                    )
                )
                calories[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { details["caloriesKcal"] = it.inKilocalories }
            }
            if (heartRateGranted) {
                val samples = readAll(HeartRateRecord::class, workout.startTime, workout.endTime, workoutOrigin)
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
        val workoutsToday = normalizedWorkouts.count { (_, time) -> time.start.atZone(zone).toLocalDate() == today }
        val newestWorkout = normalizedWorkouts.maxByOrNull { (_, time) -> time.start }
        val adjustedWorkouts = normalizedWorkouts.count { (_, time) -> time.adjustmentMinutes != 0 }
        val adjustedSleepSessions = normalizedSleep.count { (_, time) -> time.adjustmentMinutes != 0 }
        val workoutOrigins = workoutRecords.groupingBy { it.metadata.dataOrigin.packageName }.eachCount()
        val deviceZone = ZoneId.systemDefault()
        val now = Instant.now()
        val deviceOffsetMinutes = deviceZone.rules.getOffset(now).totalSeconds / 60
        val chileOffsetMinutes = zone.rules.getOffset(now).totalSeconds / 60
        batch.set(
            firestore.collection("users").document(uid).collection("wearableSyncStatus")
                .document("latest"),
            hashMapOf(
                "id" to "latest",
                "syncedAt" to syncedAt,
                "sourcePackage" to sourcePackage,
                "daysRequested" to days,
                "exerciseRecordsRead" to workoutRecords.size,
                "workoutsUploaded" to workouts.size,
                "workoutsToday" to workoutsToday,
                "workoutsClockAdjusted" to adjustedWorkouts,
                "sleepSessionsClockAdjusted" to adjustedSleepSessions,
                "newestWorkoutStartTime" to newestWorkout?.second?.start?.toString(),
                "newestWorkoutEndTime" to newestWorkout?.second?.end?.toString(),
                "newestWorkoutTitle" to newestWorkout?.first?.let { exerciseTitle(it.exerciseType) },
                "workoutOrigins" to workoutOrigins,
                "syncZoneId" to zone.id,
                "deviceZoneId" to deviceZone.id,
                "deviceOffsetMinutes" to deviceOffsetMinutes,
                "chileOffsetMinutes" to chileOffsetMinutes,
                "deviceTimeZoneMatchesChile" to (deviceOffsetMinutes == chileOffsetMinutes),
                "backgroundReadGranted" to granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
            ),
            SetOptions.merge()
        )
        batch.commit().await()
        return SyncReport(
            days,
            sleep.size,
            sleepSessionsWithStages,
            adjustedSleepSessions,
            workouts.size,
            workoutsToday,
            newestWorkout?.second?.start?.toString(),
            workoutRecords.size,
            adjustedWorkouts,
            sessionsWithHeartRate,
            heartRateSamples,
            heartRateGranted,
            granted.contains(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND),
            deviceZone.id,
            deviceOffsetMinutes,
            chileOffsetMinutes,
            syncedAt
        )
    }

    /**
     * Mi Fitness has been observed publishing a completed session one hour in
     * the future after the Chilean DST change. Health Connect stores instants,
     * so blindly subtracting an hour forever would break the next clock change.
     * Correct only when the record itself contains evidence of the stale offset:
     * a one-hour zone-offset mismatch, or an end time that was already in the
     * future when Health Connect last modified the completed record.
     */
    private fun normalizedWorkoutTime(workout: ExerciseSessionRecord): WorkoutTime {
        val origin = workout.metadata.dataOrigin.packageName
        if (!isMiFitnessSource(origin)) return WorkoutTime(workout.startTime, workout.endTime)

        val expectedStartOffset = zone.rules.getOffset(workout.startTime).totalSeconds
        val expectedEndOffset = zone.rules.getOffset(workout.endTime).totalSeconds
        val startOffsetDelta = workout.startZoneOffset?.totalSeconds?.minus(expectedStartOffset)
        val endOffsetDelta = workout.endZoneOffset?.totalSeconds?.minus(expectedEndOffset)
        val futureAtWriteSeconds = Duration.between(workout.metadata.lastModifiedTime, workout.endTime).seconds

        val adjustmentSeconds = when {
            startOffsetDelta != null && startOffsetDelta == endOffsetDelta && abs(startOffsetDelta) == 3600 ->
                startOffsetDelta.toLong()
            futureAtWriteSeconds in 120..4500 -> -3600L
            else -> 0L
        }
        val reason = when {
            adjustmentSeconds == 0L -> ""
            startOffsetDelta != null && startOffsetDelta == endOffsetDelta && abs(startOffsetDelta) == 3600 ->
                "mi_fitness_stale_zone_offset"
            else -> "mi_fitness_future_end_after_dst"
        }
        return WorkoutTime(
            workout.startTime.plusSeconds(adjustmentSeconds),
            workout.endTime.plusSeconds(adjustmentSeconds),
            (adjustmentSeconds / 60).toInt(),
            reason
        )
    }

    /**
     * Mi Fitness can retain Chile's previous UTC offset in sleep records after
     * daylight-saving time changes. Correct only an exact, consistent one-hour
     * mismatch declared by the record. Shifting both endpoints keeps the total
     * sleep duration and every stage duration unchanged.
     */
    private fun normalizedSleepTime(session: SleepSessionRecord): SleepTime {
        val origin = session.metadata.dataOrigin.packageName
        if (!isMiFitnessSource(origin)) return SleepTime(session.startTime, session.endTime)

        val expectedStartOffset = zone.rules.getOffset(session.startTime).totalSeconds
        val expectedEndOffset = zone.rules.getOffset(session.endTime).totalSeconds
        val startOffsetDelta = session.startZoneOffset?.totalSeconds?.minus(expectedStartOffset)
        val endOffsetDelta = session.endZoneOffset?.totalSeconds?.minus(expectedEndOffset)
        val adjustmentSeconds = if (
            startOffsetDelta != null &&
            startOffsetDelta == endOffsetDelta &&
            abs(startOffsetDelta) == 3600
        ) startOffsetDelta.toLong() else 0L

        return SleepTime(
            session.startTime.plusSeconds(adjustmentSeconds),
            session.endTime.plusSeconds(adjustmentSeconds),
            (adjustmentSeconds / 60).toInt(),
            if (adjustmentSeconds == 0L) "" else "mi_fitness_stale_zone_offset"
        )
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

    private fun isMiFitnessSource(packageName: String) =
        packageName.contains("xiaomi", ignoreCase = true) || packageName.contains("mifitness", ignoreCase = true)

    private fun sleepStageKey(stage: Int) = when (stage) {
        SleepSessionRecord.STAGE_TYPE_AWAKE -> "awake"
        SleepSessionRecord.STAGE_TYPE_SLEEPING -> "sleeping"
        SleepSessionRecord.STAGE_TYPE_OUT_OF_BED -> "outOfBed"
        SleepSessionRecord.STAGE_TYPE_LIGHT -> "light"
        SleepSessionRecord.STAGE_TYPE_DEEP -> "deep"
        SleepSessionRecord.STAGE_TYPE_REM -> "rem"
        SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED -> "awakeInBed"
        else -> "unknown"
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

private data class WorkoutTime(
    val start: Instant,
    val end: Instant,
    val adjustmentMinutes: Int = 0,
    val reason: String = ""
)

private data class SleepTime(
    val start: Instant,
    val end: Instant,
    val adjustmentMinutes: Int = 0,
    val reason: String = ""
)

data class SyncReport(
    val days: Int,
    val sleepSessions: Int,
    val sleepSessionsWithStages: Int,
    val sleepSessionsClockAdjusted: Int,
    val workouts: Int,
    val workoutsToday: Int,
    val newestWorkoutStartTime: String?,
    val exerciseRecordsRead: Int,
    val workoutsClockAdjusted: Int,
    val sessionsWithHeartRate: Int,
    val heartRateSamples: Int,
    val heartRateGranted: Boolean,
    val backgroundReadGranted: Boolean,
    val deviceZoneId: String,
    val deviceOffsetMinutes: Int,
    val chileOffsetMinutes: Int,
    val syncedAt: String
)
