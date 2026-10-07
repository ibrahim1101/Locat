#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const javaDir = path.join(root, "android/app/src/main/java/com/shaikibrahim/locat");
const mainActivity = path.join(javaDir, "MainActivity.java");
if (!fs.existsSync(mainActivity)) throw new Error("Capacitor Android project is missing. Run cap add android first.");

const plugin = `package com.shaikibrahim.locat;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LocatStorage")
public class LocatStoragePlugin extends Plugin {
    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "directoryPicked");
    }

    @ActivityCallback
    private void directoryPicked(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            call.reject("Folder selection was cancelled.");
            return;
        }
        Uri uri = data.getData();
        int flags = data.getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (SecurityException error) {
            call.reject("Android could not persist access to this folder.", error);
            return;
        }
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        String documentId = DocumentsContract.getTreeDocumentId(uri);
        ret.put("name", documentId == null ? "Selected Android folder" : documentId);
        call.resolve(ret);
    }
}
`;

fs.writeFileSync(path.join(javaDir, "LocatStoragePlugin.java"), plugin);
let main = fs.readFileSync(mainActivity, "utf8");
if (!main.includes("registerPlugin(LocatStoragePlugin.class)")) {
  main = main.replace("import com.getcapacitor.BridgeActivity;", "import com.getcapacitor.BridgeActivity;\nimport android.os.Bundle;");
  main = main.replace(/public class MainActivity extends BridgeActivity\s*\{[\s\S]*?\}/, `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocatStoragePlugin.class);
        super.onCreate(savedInstanceState);
    }
}`);
  fs.writeFileSync(mainActivity, main);
}
