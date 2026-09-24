package cl.tgtrain.sync

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.lifecycleScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MainActivity : ComponentActivity() {
    private val bgColor = Color.rgb(17, 21, 34)
    private val lime = Color.rgb(200, 255, 77)
    private val ink = Color.rgb(21, 23, 29)
    private val service by lazy { HealthSyncService(this) }
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val credentials by lazy { CredentialManager.create(this) }
    private lateinit var account: TextView
    private lateinit var status: TextView
    private lateinit var sourcePicker: Spinner
    private lateinit var signInButton: Button
    private lateinit var permissionButton: Button
    private lateinit var scanButton: Button
    private lateinit var syncButton: Button
    private lateinit var signOutButton: Button
    private var sources: List<String> = emptyList()
    private var busy = false

    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        status.text = if (granted.containsAll(HealthSyncService.essentialPermissions)) {
            "Permisos concedidos. Buscando datos de Mi Fitness…"
        } else {
            "Faltan permisos para leer pasos, sueño o ejercicios."
        }
        if (granted.containsAll(HealthSyncService.essentialPermissions)) discoverSources()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildScreen()
        refreshAccount()
        val sdkStatus = HealthConnectClient.getSdkStatus(this)
        if (sdkStatus != HealthConnectClient.SDK_AVAILABLE) {
            status.text = "Health Connect no está disponible. Instálalo o actualízalo y vuelve a abrir TGTrain Sync."
            permissionButton.isEnabled = false
            scanButton.isEnabled = false
            syncButton.isEnabled = false
            return
        }
        lifecycleScope.launch {
            try {
                if (service.grantedPermissions().containsAll(HealthSyncService.essentialPermissions)) {
                    discoverSources()
                } else status.text = "Conecta TGTrain Sync a Health Connect para continuar."
            } catch (error: Exception) {
                status.text = "No se pudo consultar Health Connect: ${error.localizedMessage}"
            }
        }
    }

    private fun buildScreen() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(30), dp(20), dp(35))
            setBackgroundColor(bgColor)
        }
        val scroll = ScrollView(this).apply { isFillViewport = true; addView(root) }
        setContentView(scroll)

        root.addView(text("TGTrain Sync", 29f, lime, true))
        root.addView(text("Tu pulsera, conectada con tu diario de entrenamiento.", 15f, Color.WHITE).apply {
            setPadding(0, dp(8), 0, dp(22))
        })
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(18), dp(18), dp(18))
            background = rounded(Color.WHITE, 23f)
        }
        root.addView(card, LinearLayout.LayoutParams(-1, -2))
        card.addView(text("1 · Cuenta de TGTrain", 17f, ink, true))
        account = text("Sin iniciar sesión", 14f, Color.DKGRAY)
        card.addView(account)
        signInButton = action("Entrar con Google", true) { signIn() }
        card.addView(signInButton)

        card.addView(text("2 · Permiso de salud", 17f, ink, true).apply { setPadding(0, dp(20), 0, 0) })
        card.addView(text("Solo leerá pasos, sueño y sesiones. Distancia y calorías son opcionales.", 13f, Color.DKGRAY))
        permissionButton = action("Permitir acceso a Health Connect") {
            permissionLauncher.launch(HealthSyncService.allPermissions)
        }
        card.addView(permissionButton)

        card.addView(text("3 · Fuente de datos", 17f, ink, true).apply { setPadding(0, dp(20), 0, 0) })
        card.addView(text("Elige Mi Fitness. No mezclaremos pasos del teléfono con los de la pulsera.", 13f, Color.DKGRAY))
        sourcePicker = Spinner(this)
        card.addView(sourcePicker, LinearLayout.LayoutParams(-1, dp(52)))
        scanButton = action("Buscar fuentes") { discoverSources() }
        card.addView(scanButton)

        syncButton = action("Sincronizar ahora", true) { syncNow() }
        card.addView(syncButton)
        status = text("Preparando conexión…", 13f, Color.DKGRAY)
        status.setPadding(0, dp(18), 0, 0)
        card.addView(status)

        signOutButton = action("Cerrar sesión") {
            auth.signOut()
            lifecycleScope.launch {
                try { credentials.clearCredentialState(ClearCredentialStateRequest()) } catch (_: Exception) { }
                refreshAccount()
                status.text = "Sesión cerrada. Los datos ya enviados permanecen en tu cuenta de TGTrain."
            }
        }
        root.addView(signOutButton)
        root.addView(text("TGTrain Sync no modifica tus entrenamientos manuales. Al abrir esta app, puedes actualizar los últimos 14 días; los entrenamientos detectados se guardan aparte para evitar duplicados.", 12f, Color.LTGRAY).apply {
            setPadding(0, dp(12), 0, 0)
        })
    }

    private fun refreshAccount() {
        val user = auth.currentUser
        account.text = if (user == null) "Sin iniciar sesión" else "${user.email ?: user.displayName}\nLa sesión queda guardada en este teléfono."
        signInButton.visibility = if (user == null) View.VISIBLE else View.GONE
        signOutButton.visibility = if (user == null) View.GONE else View.VISIBLE
        syncButton.isEnabled = user != null && sources.isNotEmpty() && !busy
    }

    private fun signIn() {
        lifecycleScope.launch {
            setBusy(true, "Abriendo tu cuenta de Google…")
            try {
                val option = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(getString(R.string.default_web_client_id))
                    .build()
                val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                val result = credentials.getCredential(this@MainActivity, request)
                val credential = result.credential as? CustomCredential
                    ?: error("Google no entregó una credencial compatible.")
                check(credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                    "La credencial recibida no es de Google."
                }
                val idToken = GoogleIdTokenCredential.createFrom(credential.data).idToken
                auth.signInWithCredential(GoogleAuthProvider.getCredential(idToken, null)).await()
                refreshAccount()
                status.text = "Cuenta conectada. Usa el mismo Gmail que en TGTrain."
            } catch (error: Exception) {
                status.text = "No se pudo iniciar sesión: ${error.localizedMessage}"
            } finally { setBusy(false) }
        }
    }

    private fun discoverSources() {
        lifecycleScope.launch {
            setBusy(true, "Buscando fuentes de los últimos 30 días…")
            try {
                val granted = service.grantedPermissions()
                if (!granted.containsAll(HealthSyncService.essentialPermissions)) {
                    status.text = "Primero concede los permisos de Health Connect."
                    return@launch
                }
                sources = service.availableSources()
                val labels = sources.map { packageName ->
                    if (packageName.contains("xiaomi", true) || packageName.contains("mifitness", true))
                        "Mi Fitness · $packageName" else packageName
                }
                sourcePicker.adapter = ArrayAdapter(this@MainActivity,
                    android.R.layout.simple_spinner_dropdown_item, labels)
                val saved = getPreferences(MODE_PRIVATE).getString("sourcePackage", "")
                val selected = sources.indexOf(saved).takeIf { it >= 0 }
                    ?: sources.indexOfFirst { it.contains("xiaomi", true) || it.contains("mifitness", true) }
                if (selected >= 0) sourcePicker.setSelection(selected)
                status.text = if (sources.isEmpty())
                    "No encontré registros recientes. Abre Mi Fitness, sincroniza la pulsera y vuelve a buscar."
                else "${sources.size} fuente(s) encontrada(s). Elige Mi Fitness y sincroniza."
                refreshAccount()
            } catch (error: Exception) {
                status.text = "No se pudieron buscar fuentes: ${error.localizedMessage}"
            } finally { setBusy(false) }
        }
    }

    private fun syncNow() {
        val source = sources.getOrNull(sourcePicker.selectedItemPosition)
        if (source == null) { status.text = "Elige primero una fuente."; return }
        lifecycleScope.launch {
            setBusy(true, "Leyendo Health Connect y subiendo datos a tu cuenta…")
            try {
                val report = service.sync(source)
                getPreferences(MODE_PRIVATE).edit().putString("sourcePackage", source).apply()
                status.text = "Sincronizado: ${report.days} días, ${report.sleepSessions} sesiones de sueño y ${report.workouts} entrenamientos. Abre TGTrain para verlos."
            } catch (error: Exception) {
                status.text = "No se pudo sincronizar: ${error.localizedMessage}"
            } finally { setBusy(false) }
        }
    }

    private fun setBusy(value: Boolean, message: String? = null) {
        busy = value
        if (message != null) status.text = message
        signInButton.isEnabled = !value
        permissionButton.isEnabled = !value
        scanButton.isEnabled = !value
        syncButton.isEnabled = !value && auth.currentUser != null && sources.isNotEmpty()
    }

    private fun action(label: String, primary: Boolean = false, onClick: () -> Unit): Button =
        Button(this).apply {
            text = label
            textSize = 14f
            isAllCaps = false
            setTextColor(if (primary) bgColor else ink)
            background = rounded(if (primary) lime else Color.rgb(244, 243, 238), 14f)
            setOnClickListener { onClick() }
            val params = LinearLayout.LayoutParams(-1, dp(50))
            params.topMargin = dp(10)
            layoutParams = params
        }

    private fun text(value: String, size: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        if (bold) setTypeface(typeface, Typeface.BOLD)
        setLineSpacing(dp(2).toFloat(), 1f)
    }

    private fun rounded(color: Int, radius: Float) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius.toInt()).toFloat()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
