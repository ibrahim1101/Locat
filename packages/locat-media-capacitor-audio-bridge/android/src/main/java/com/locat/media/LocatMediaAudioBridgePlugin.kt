package com.locat.media

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * LocatMediaAudioBridge — Android native side.
 *
 * SCAFFOLD STATUS:
 *   * getCapabilities(): reports the real AudioManager-observed state
 *     (default device, support flags). Lightweight; no stream opened.
 *   * verifyBitPerfect(): TODO. Must open an AAudio stream with
 *     setSharingMode(EXCLUSIVE) + setPerformanceMode(LOW_LATENCY) +
 *     setFormat(matching the track's bit depth) and compare
 *     stream.getSampleRate() / stream.getFormat() with the source
 *     track. ONLY if the stream really opened in EXCLUSIVE mode AND
 *     rate/format match, set verifiedBitPerfect = true.
 *   * reportToServer(): HTTP POST to the Locat media hub. Server
 *     authentication must be an admin bearer token; otherwise the
 *     server rejects the report. Never report verified without actual
 *     native evidence.
 *
 * This file is deliberately conservative: it reports verified = false
 * everywhere until the native stream opening logic is implemented.
 */
@CapacitorPlugin(name = "LocatMediaAudioBridge")
class LocatMediaAudioBridgePlugin : Plugin() {

    @PluginMethod
    fun getCapabilities(call: PluginCall) {
        val ctx = context ?: run { call.reject("no context"); return }
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager

        val caps = JSObject()
        caps.put("runtime", "android")

        val device = defaultOutputDevice(am)
        caps.put("device", device?.toJson())

        // "supports exclusive" is a property of AAudio, not AudioManager.
        // We expose true only on API 26+ where AAudio exists; the actual
        // stream-opening test lives in verifyBitPerfect().
        caps.put("supportsExclusive", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
        caps.put("supportsLowLatency",
            ctx.packageManager.hasSystemFeature("android.hardware.audio.low_latency"))
        caps.put("outputSampleRate", JSONObject.NULL)
        caps.put("outputBitDepth", JSONObject.NULL)
        caps.put("resamplingDetected", JSONObject.NULL)
        caps.put("verifiedBitPerfect", false)
        caps.put("reason", "Capabilities only — call verifyBitPerfect to open an exclusive stream.")
        call.resolve(caps)
    }

    @PluginMethod
    fun setMode(call: PluginCall) {
        val mode = call.getString("mode") ?: ""
        if (mode != "pure_audio" && mode != "enhanced_dsp") {
            call.reject("mode must be pure_audio or enhanced_dsp")
            return
        }
        // TODO(native): reconfigure the ExoPlayer / AAudio renderer.
        // In Pure Audio, bypass the Locat DSP renderer and route PCM
        // straight to AAudio in EXCLUSIVE mode where possible.
        // In Enhanced DSP, insert the Locat DSP processor in the chain.
        getCapabilities(call)
    }

    @PluginMethod
    fun verifyBitPerfect(call: PluginCall) {
        val sampleRate = call.getInt("trackSampleRate") ?: 0
        val bitDepth = call.getInt("trackBitDepth") ?: 0
        val channels = call.getInt("trackChannels") ?: 0
        val ctx = context ?: run { call.reject("no context"); return }
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager

        // Honest reporting: we only tag `verifiedBitPerfect = true` when
        // AAudio returns a stream whose sharing-mode is EXCLUSIVE AND
        // sampleRate+encoding match the source track.
        //
        // The real native path uses the C AAudio API (NDK). From Kotlin
        // we reach it via AudioTrack with .setPerformanceMode(LOW_LATENCY)
        // + .setSessionId(AudioManager.AUDIO_SESSION_ID_GENERATE). API 26+.
        //
        // IMPLEMENTATION OUTLINE (requires NDK bridge for true EXCLUSIVE):
        //  1. AudioAttributes.Builder() .setContentType(CONTENT_TYPE_MUSIC)
        //     .setUsage(USAGE_MEDIA)
        //  2. AudioFormat.Builder()
        //     .setSampleRate(sampleRate)
        //     .setEncoding(bitDepth==24? ENCODING_PCM_FLOAT :
        //                  bitDepth==16? ENCODING_PCM_16BIT : ...)
        //     .setChannelMask(stereo or mono).
        //  3. AudioTrack track = Builder().setAudioAttributes(...).
        //     setAudioFormat(...).setPerformanceMode(PERFORMANCE_MODE_LOW_LATENCY).
        //     setTransferMode(MODE_STREAM).build()
        //  4. track.getSampleRate() must == sampleRate
        //  5. track.getFormat().getEncoding() must match requested encoding
        //  6. track.getPerformanceMode() must == PERFORMANCE_MODE_LOW_LATENCY
        //  AAudio EXCLUSIVE sharing-mode is only reachable via the NDK
        //  (AAudioStreamBuilder_setSharingMode(EXCLUSIVE)). Add a JNI
        //  shim that returns the realized sharing mode; only set
        //  verifiedBitPerfect = true when it is actually EXCLUSIVE.

        val caps = JSObject().apply {
            put("runtime", "android")
            put("device", defaultOutputDevice(am)?.toJson() ?: JSONObject.NULL)
            put("supportsExclusive", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            put("supportsLowLatency",
                ctx.packageManager.hasSystemFeature("android.hardware.audio.low_latency"))
            put("outputSampleRate",
                if (sampleRate > 0) sampleRate else JSONObject.NULL)
            put("outputBitDepth",
                if (bitDepth > 0) bitDepth else JSONObject.NULL)
            put("resamplingDetected", JSONObject.NULL)
            put("verifiedBitPerfect", false)   // never true until NDK shim lands
            put("reason", "AAudio exclusive-mode open requires the NDK bridge documented in LocatMediaAudioBridgePlugin.kt; running from the Kotlin plugin alone cannot guarantee EXCLUSIVE sharing. Reporting verified=false.")
        }
        call.resolve(caps)
    }

    @PluginMethod
    fun reportToServer(call: PluginCall) {
        val baseUrl = call.getString("apiBaseUrl") ?: run { call.reject("apiBaseUrl required"); return }
        val token = call.getString("authToken") ?: run { call.reject("authToken required"); return }
        val deviceId = call.getString("deviceId") ?: run { call.reject("deviceId required"); return }
        val caps = call.getObject("capabilities") ?: run { call.reject("capabilities required"); return }
        val verified = caps.optBoolean("verifiedBitPerfect", false)
        val reason = caps.optString("reason", "")

        Thread {
            try {
                val url = URL("$baseUrl/music/audio-mode/report-verified")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.doOutput = true
                val body = JSONObject().apply {
                    put("device_id", deviceId)
                    put("verified", verified)
                    put("evidence", JSONObject().apply {
                        put("reason", reason)
                        put("output_sample_rate", caps.opt("outputSampleRate"))
                        put("output_bit_depth", caps.opt("outputBitDepth"))
                    })
                }
                conn.outputStream.use { it.write(body.toString().toByteArray()) }
                val ok = conn.responseCode in 200..299
                val out = JSObject(); out.put("ok", ok); call.resolve(out)
            } catch (e: Exception) {
                call.reject("report failed: ${e.message}")
            }
        }.start()
    }

    @PluginMethod
    fun listOutputDevices(call: PluginCall) {
        val am = audioManager() ?: run { call.reject("no audio manager"); return }
        val devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        val arr = org.json.JSONArray()
        for (d in devices) arr.put(d.toJson())
        val out = JSObject(); out.put("devices", arr); call.resolve(out)
    }

    private fun audioManager(): AudioManager? =
        (context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager)

    private fun defaultOutputDevice(am: AudioManager?): AudioDeviceInfo? {
        am ?: return null
        return am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).firstOrNull()
    }

    private fun AudioDeviceInfo.toJson(): JSONObject {
        val type = when (type) {
            AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "builtin_speaker"
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired_headset"
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_USB_DEVICE,
            AudioDeviceInfo.TYPE_USB_ACCESSORY -> "usb_dac"
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "bluetooth_a2dp"
            AudioDeviceInfo.TYPE_HEARING_AID -> "bluetooth_hearing_aid"
            AudioDeviceInfo.TYPE_AUX_LINE -> "aux"
            AudioDeviceInfo.TYPE_HDMI, AudioDeviceInfo.TYPE_HDMI_ARC -> "hdmi"
            else -> "unknown"
        }
        return JSONObject().apply {
            put("id", id.toString())
            put("name", productName?.toString() ?: "Output")
            put("type", type)
            put("isDefault", false)
        }
    }
}
