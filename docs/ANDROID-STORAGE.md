# Android storage and encrypted exports

Locat's Android app can save user-requested attachment downloads and encrypted
history backups into a folder selected through Android's Storage Access Framework.

- The selection is made in **Settings & backups → Downloads & encrypted exports**.
- The persisted Android document-tree permission is reused after restarting Locat.
- Identity keys, bearer sessions, IndexedDB history and other runtime data always
  remain inside protected app/browser storage.
- When no Android folder is selected, browsers use their normal download manager.
- If Android revokes access, Locat fails closed with instructions to select the
  folder again. It does not silently create an unexpected browser copy.
- Backup files are already encrypted before Locat hands them to Android storage.
  Filenames and file bytes are visible to the chosen storage provider after the
  user explicitly exports or downloads them.

## Physical acceptance

1. In the APK, open Settings & backups and choose a new empty folder.
2. Download a received attachment and export an encrypted history backup. Confirm
   both appear in that folder.
3. Restart the APK and repeat both actions without selecting the folder again.
4. Revoke Locat's folder access in Android settings or remove/recreate the folder.
   Confirm saving fails with reselect guidance and creates no fallback copy.
5. Choose the folder again and confirm both operations recover.
6. Select Use browser downloads and confirm normal browser/APK download handling.
