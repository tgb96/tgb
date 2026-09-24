package cl.tgtrain.sync

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val density = resources.displayMetrics.density
        val padding = (24 * density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(Color.WHITE)
        }
        fun paragraph(value: String, size: Float) = TextView(this).apply {
            text = value
            textSize = size
            setTextColor(Color.rgb(21, 23, 29))
            setPadding(0, 0, 0, (16 * density).toInt())
        }
        content.addView(paragraph("Privacidad de TGTrain Sync", 25f))
        content.addView(paragraph("TGTrain Sync lee pasos, sueño y sesiones de ejercicio desde Health Connect para mostrarlos en tu cuenta personal de TGTrain. Si autorizas distancia y calorías activas, esos valores se incorporan a las sesiones detectadas.", 16f))
        content.addView(paragraph("Los datos se envían únicamente al espacio de tu usuario en Firebase. La app no modifica Health Connect ni los entrenamientos que registraste manualmente. Puedes quitarle el acceso cuando quieras desde Health Connect y cerrar sesión desde TGTrain Sync.", 16f))
        content.addView(paragraph("TGTrain Sync solo sincroniza al pulsar «Sincronizar ahora». No lee datos en segundo plano.", 16f))
        setContentView(ScrollView(this).apply { addView(content) })
    }
}
