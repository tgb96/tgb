package cl.tgtrain.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import java.util.concurrent.TimeUnit

object AutomaticSync {
    private const val JOB_NAME = "tgtrain_health_connect_sync"
    private const val RECOVERY_JOB_NAME = "tgtrain_health_connect_recovery"
    const val INTERVAL_MINUTES = 15L
    private val RECOVERY_DELAYS_MINUTES = listOf(2L, 8L, 20L)

    suspend fun refresh(context: Context) {
        val service = HealthSyncService(context)
        val eligible = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE &&
            FirebaseAuth.getInstance().currentUser != null &&
            SyncPreferences.source(context).isNotBlank() &&
            service.backgroundReadAvailable &&
            service.grantedPermissions().containsAll(
                HealthSyncService.essentialPermissions + HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
            )
        val manager = WorkManager.getInstance(context)
        if (!eligible) {
            manager.cancelUniqueWork(JOB_NAME)
            return
        }
        val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(INTERVAL_MINUTES, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        manager.enqueueUniquePeriodicWork(JOB_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    fun scheduleRecovery(context: Context) {
        val manager = WorkManager.getInstance(context)
        RECOVERY_DELAYS_MINUTES.forEach { delay ->
            val request = OneTimeWorkRequestBuilder<HealthSyncWorker>()
                .setInitialDelay(delay, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            manager.enqueueUniqueWork(
                "${RECOVERY_JOB_NAME}_$delay",
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}

class HealthSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val source = SyncPreferences.source(applicationContext)
        if (source.isBlank() || FirebaseAuth.getInstance().currentUser == null) return Result.success()
        return try {
            val service = HealthSyncService(applicationContext)
            if (!service.backgroundReadAvailable || !service.grantedPermissions().containsAll(
                    HealthSyncService.essentialPermissions + HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND
                )) return Result.success()
            // Mi Fitness puede publicar sueño o ejercicio con retraso. Releer
            // una semana recupera datos que todavía no estaban en Health
            // Connect cuando se ejecutó la sincronización anterior.
            service.sync(source, days = 7)
            SyncPreferences.markSuccess(applicationContext, source)
            Result.success()
        } catch (_: SecurityException) {
            Result.success() // Permission was revoked; wait for the user to grant it again.
        } catch (_: Exception) {
            Result.retry() // Network or Firebase failure; WorkManager retries with backoff.
        }
    }
}
