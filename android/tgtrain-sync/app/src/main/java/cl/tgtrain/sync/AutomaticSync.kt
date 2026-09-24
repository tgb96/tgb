package cl.tgtrain.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import java.util.concurrent.TimeUnit

object AutomaticSync {
    private const val JOB_NAME = "tgtrain_health_connect_sync"
    const val INTERVAL_MINUTES = 30L

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
        manager.enqueueUniquePeriodicWork(JOB_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
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
            service.sync(source, days = 2)
            SyncPreferences.markSuccess(applicationContext, source)
            Result.success()
        } catch (_: SecurityException) {
            Result.success() // Permission was revoked; wait for the user to grant it again.
        } catch (_: Exception) {
            Result.retry() // Network or Firebase failure; WorkManager retries with backoff.
        }
    }
}
