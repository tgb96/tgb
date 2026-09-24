package cl.tgtrain.sync

import android.content.Context

object SyncPreferences {
    private const val NAME = "tgtrain_sync"
    private const val LEGACY_NAME = "MainActivity"
    private const val SOURCE = "sourcePackage"
    private const val LAST_SUCCESS = "lastSuccessfulSyncMillis"

    fun source(context: Context): String {
        val current = context.getSharedPreferences(NAME, Context.MODE_PRIVATE).getString(SOURCE, "")
        return current?.takeIf { it.isNotBlank() }
            ?: context.getSharedPreferences(LEGACY_NAME, Context.MODE_PRIVATE).getString(SOURCE, "").orEmpty()
    }

    fun lastSuccess(context: Context): Long =
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE).getLong(LAST_SUCCESS, 0L)

    fun markSuccess(context: Context, sourcePackage: String) {
        context.getSharedPreferences(NAME, Context.MODE_PRIVATE).edit()
            .putString(SOURCE, sourcePackage)
            .putLong(LAST_SUCCESS, System.currentTimeMillis())
            .apply()
    }
}
