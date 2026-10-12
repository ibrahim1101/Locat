package com.shaikibrahim.locat;

import android.Manifest;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Read-only, paged discovery of system-indexed shared media. Never uploads or copies videos. */
@CapacitorPlugin(name = "LocatMedia", permissions = {
    @Permission(alias = "legacy", strings = {Manifest.permission.READ_EXTERNAL_STORAGE}),
    @Permission(alias = "cinema", strings = {"android.permission.READ_MEDIA_VIDEO"}),
    @Permission(alias = "photos", strings = {"android.permission.READ_MEDIA_IMAGES"}),
    @Permission(alias = "music", strings = {"android.permission.READ_MEDIA_AUDIO"}),
    @Permission(alias = "selected", strings = {"android.permission.READ_MEDIA_VISUAL_USER_SELECTED"})
})
public class LocatMediaPlugin extends Plugin {
    @Override
    public void load() {
        // Capacitor 8's default content handler uses int-sized available() and does
        // not seek the content stream for Range requests. Keep the standard bridge
        // client for every other URL, but serve our own indexed media with long ranges.
        getBridge().executeOnMainThread(() -> getBridge().setWebViewClient(new com.getcapacitor.BridgeWebViewClient(getBridge()) {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(android.webkit.WebView view, android.webkit.WebResourceRequest request) {
                android.webkit.WebResourceResponse media = mediaResponse(request);
                return media == null ? super.shouldInterceptRequest(view, request) : media;
            }
        }));
    }
    private android.webkit.WebResourceResponse emptyResponse(int status, String reason, java.util.Map<String, String> headers) {
        return new android.webkit.WebResourceResponse("text/plain", "UTF-8", status, reason, headers, new java.io.ByteArrayInputStream(new byte[0]));
    }
    private android.webkit.WebResourceResponse mediaResponse(android.webkit.WebResourceRequest request) {
        Uri url = request.getUrl();
        if (!"https".equals(url.getScheme()) || !"localhost".equals(url.getHost()) || !url.getPath().startsWith("/_locat_media_/")) return null;
        java.util.Map<String, String> headers = new java.util.HashMap<>(); headers.put("Cache-Control", "no-store"); headers.put("Accept-Ranges", "bytes");
        java.io.FileInputStream stream = null;
        android.content.res.AssetFileDescriptor descriptor = null;
        try {
            java.util.List<String> parts = url.getPathSegments();
            if (parts.size() != 3 || !valid(parts.get(1)) || !parts.get(2).matches("[0-9]{1,19}")) return emptyResponse(404, "Not Found", headers);
            if (!"GET".equals(request.getMethod()) && !"HEAD".equals(request.getMethod())) return emptyResponse(405, "Method Not Allowed", headers);
            String kind = parts.get(1);
            if ("denied".equals(access(kind))) return emptyResponse(403, "Forbidden", headers);
            Uri collection = "photos".equals(kind) ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : "music".equals(kind) ? MediaStore.Audio.Media.EXTERNAL_CONTENT_URI : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
            Uri media = ContentUris.withAppendedId(collection, Long.parseLong(parts.get(2)));
            long length;
            String mime;
            try (Cursor cursor = getContext().getContentResolver().query(media, new String[] {"_size", "mime_type"}, null, null, null)) {
                if (cursor == null || !cursor.moveToFirst()) return emptyResponse(404, "Not Found", headers);
                length = cursor.getLong(0); mime = cursor.getString(1);
            }
            if (length <= 0) return emptyResponse(404, "Not Found", headers);
            String range = request.getRequestHeaders().get("Range");
            if (range == null) range = request.getRequestHeaders().get("range");
            long[] bounds = MediaByteRange.parse(range, length);
            if (bounds == null) { headers.put("Content-Range", "bytes */" + length); return emptyResponse(416, "Range Not Satisfiable", headers); }
            long start = bounds[0], end = bounds[1], count = end - start + 1;
            headers.put("Content-Length", Long.toString(count));
            int status = range == null ? 200 : 206;
            if (range != null) headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
            if ("HEAD".equals(request.getMethod())) return emptyResponse(status, status == 200 ? "OK" : "Partial Content", headers);
            descriptor = getContext().getContentResolver().openAssetFileDescriptor(media, "r");
            if (descriptor == null) return emptyResponse(404, "Not Found", headers);
            stream = descriptor.createInputStream();
            stream.getChannel().position(descriptor.getStartOffset() + start);
            final java.io.FileInputStream input = stream;
            final android.content.res.AssetFileDescriptor ownedDescriptor = descriptor;
            java.io.InputStream bounded = new java.io.FilterInputStream(input) {
                long remaining = count;
                @Override public int read() throws java.io.IOException { if (remaining <= 0) return -1; int value = in.read(); if (value >= 0) remaining--; return value; }
                @Override public int read(byte[] bytes, int offset, int requested) throws java.io.IOException { if (requested == 0) return 0; if (remaining <= 0) return -1; int read = in.read(bytes, offset, (int) Math.min(remaining, requested)); if (read > 0) remaining -= read; return read; }
                @Override public int available() throws java.io.IOException { return (int) Math.min(remaining, in.available()); }
                @Override public void close() throws java.io.IOException { try { super.close(); } finally { ownedDescriptor.close(); } }
            };
            stream = null; descriptor = null;
            return new android.webkit.WebResourceResponse(mime == null ? "application/octet-stream" : mime, null, status, status == 200 ? "OK" : "Partial Content", headers, bounded);
        } catch (Exception error) { return emptyResponse(404, "Not Found", headers); }
        finally { try { if (stream != null) stream.close(); if (descriptor != null) descriptor.close(); } catch (java.io.IOException ignored) {} }
    }
    private boolean valid(String kind) { return "cinema".equals(kind) || "music".equals(kind) || "photos".equals(kind); }
    private String access(String kind) {
        String alias = Build.VERSION.SDK_INT >= 33 ? kind : "legacy";
        if (getPermissionState(alias) == PermissionState.GRANTED) return "full";
        if (Build.VERSION.SDK_INT >= 34 && !"music".equals(kind) && getPermissionState("selected") == PermissionState.GRANTED) return "limited";
        return "denied";
    }
    @PluginMethod
    public void status(PluginCall call) {
        String kind = call.getString("kind");
        if (!valid(kind)) { call.reject("Unknown media section."); return; }
        JSObject result = new JSObject(); result.put("access", access(kind)); call.resolve(result);
    }
    @PluginMethod
    public void authorize(PluginCall call) {
        String kind = call.getString("kind");
        if (!valid(kind)) { call.reject("Unknown media section."); return; }
        if (Build.VERSION.SDK_INT >= 34 && !"music".equals(kind)) {
            requestPermissionForAliases(new String[] {kind, "selected"}, call, "permissionResult");
        } else requestPermissionForAlias(Build.VERSION.SDK_INT >= 33 ? kind : "legacy", call, "permissionResult");
    }
    @PermissionCallback
    private void permissionResult(PluginCall call) { status(call); }

    @PluginMethod
    public void thumbnail(PluginCall call) {
        String kind = call.getString("kind"), id = call.getString("id", "");
        if (!valid(kind) || "music".equals(kind) || !id.matches("[0-9]{1,19}") || "denied".equals(access(kind))) { call.reject("Thumbnail unavailable."); return; }
        getBridge().execute(() -> {
            android.graphics.Bitmap bitmap = null;
            try {
                long mediaId = Long.parseLong(id);
                boolean photos = "photos".equals(kind);
                Uri collection = photos ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                if (Build.VERSION.SDK_INT >= 29) bitmap = getContext().getContentResolver().loadThumbnail(ContentUris.withAppendedId(collection, mediaId), new android.util.Size(160, 160), null);
                else bitmap = photos ? MediaStore.Images.Thumbnails.getThumbnail(getContext().getContentResolver(), mediaId, MediaStore.Images.Thumbnails.MINI_KIND, null) : MediaStore.Video.Thumbnails.getThumbnail(getContext().getContentResolver(), mediaId, MediaStore.Video.Thumbnails.MINI_KIND, null);
                if (bitmap == null) { call.reject("Thumbnail unavailable."); return; }
                java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
                bitmap.compress(android.graphics.Bitmap.CompressFormat.JPEG, 65, output);
                JSObject result = new JSObject(); result.put("data", "data:image/jpeg;base64," + android.util.Base64.encodeToString(output.toByteArray(), android.util.Base64.NO_WRAP)); call.resolve(result);
            } catch (Exception error) { call.reject("Thumbnail unavailable.", error); }
            finally { if (bitmap != null) bitmap.recycle(); }
        });
    }
    @PluginMethod
    public void list(PluginCall call) {
        String kind = call.getString("kind");
        if (!valid(kind)) { call.reject("Unknown media section."); return; }
        if ("denied".equals(access(kind))) { call.reject("Media permission is unavailable. Grant access first."); return; }
        // Queries run away from the UI thread; no raw filesystem paths or broad storage permission.
        getBridge().execute(() -> {
            try {
                boolean music = "music".equals(kind), photos = "photos".equals(kind);
                Uri collection = music ? MediaStore.Audio.Media.EXTERNAL_CONTENT_URI : photos ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                java.util.ArrayList<String> columns = new java.util.ArrayList<>();
                columns.add("_id"); columns.add("_display_name"); columns.add("mime_type"); columns.add("_size"); columns.add("date_modified");
                if (Build.VERSION.SDK_INT >= 29) columns.add("relative_path");
                if (music) { columns.add("album"); columns.add("artist"); columns.add("duration"); }
                else { columns.add("bucket_display_name"); if (!photos) columns.add("duration"); }
                String before = call.getString("before", "");
                if (!before.isEmpty() && !before.matches("[0-9]{1,19}")) { call.reject("Invalid library cursor."); return; }
                String selection = before.isEmpty() ? null : "_id < ?";
                String[] args = before.isEmpty() ? null : new String[] { before };
                JSArray items = new JSArray(); String next = "";
                try (Cursor cursor = getContext().getContentResolver().query(collection, columns.toArray(new String[0]), selection, args, "_id DESC")) {
                    if (cursor != null) {
                        int count = 0;
                        while (cursor.moveToNext()) {
                            if (count == 200) { next = items.getJSONObject(199).getString("id"); break; }
                            long id = cursor.getLong(cursor.getColumnIndexOrThrow("_id"));
                            JSObject row = new JSObject(); row.put("id", Long.toString(id)); row.put("uri", "https://localhost/_locat_media_/" + kind + "/" + id);
                            row.put("name", cursor.getString(cursor.getColumnIndexOrThrow("_display_name")));
                            row.put("mime", cursor.getString(cursor.getColumnIndexOrThrow("mime_type")));
                            row.put("size", cursor.getLong(cursor.getColumnIndexOrThrow("_size")));
                            row.put("modified", cursor.getLong(cursor.getColumnIndexOrThrow("date_modified")) * 1000L);
                            String folder = Build.VERSION.SDK_INT >= 29 ? cursor.getString(cursor.getColumnIndexOrThrow("relative_path")) : music ? "Music" : cursor.getString(cursor.getColumnIndexOrThrow("bucket_display_name"));
                            row.put("folder", folder == null || folder.isEmpty() ? "Other" : folder);
                            if (music) { row.put("album", cursor.getString(cursor.getColumnIndexOrThrow("album"))); row.put("artist", cursor.getString(cursor.getColumnIndexOrThrow("artist"))); }
                            row.put("duration", photos ? 0 : cursor.getLong(cursor.getColumnIndexOrThrow("duration")));
                            items.put(row); count++;
                        }
                    }
                }
                JSObject result = new JSObject(); result.put("items", items); result.put("next", next); result.put("access", access(kind)); call.resolve(result);
            } catch (Exception error) { call.reject("Could not read the device media library. Refresh permission or try again.", error); }
        });
    }
}
