# Device media libraries

Cinema, Music and Photos now include a device library in signed-in and non-server sections.

## Android

Choose **Allow media access** in each section. The permission is scoped to videos, audio or images on Android 13+, with legacy read permission on older versions. Android 14+ selected visual access is supported and labeled **Selected photos/videos only**; only the system-authorized selection is listed. **Change media access** reopens the permission flow (a permanently denied grant may require Android Settings). Returning to the foreground, reopening a section or choosing **Refresh library** rechecks permissions and rebuilds the index. No grant is requested automatically on app launch.

After permission, Locat discovers MediaStore-indexed shared files automatically, in 200-row metadata pages. Movies/music are played through a read-only native media stream backed by content URIs without copying the entire file through JavaScript or base64. Photos are read only when opened and are capped at 20 MB before editing. Native photo/video thumbnails are requested on demand as rows become visible. No files, names, metadata or thumbnails are uploaded to a server.

Default grouping uses Android's original relative folder paths (bucket names on older Android). Music also offers album and artist grouping from the device's metadata. Unknown metadata has an explicit group. Names are naturally sorted, so Movie 2 precedes Movie 10. Sorting options: name A–Z, newest, oldest, largest, plus longest for indexed music/video. Search matches names, folders, albums and artists. Folder/album cards open a paginated 60-item view instead of flattening the entire library into one list. Music advances through the selected group's sorted tracks, subject to WebView autoplay policy.

This follows the system media index and accessible shared storage, not every vendor gallery's custom albums/favorites/cloud view. Private app storage, unindexed files, unavailable cloud items, and files outside a selected-access grant are not exposed. Refresh after adding/removing files while Locat stays foreground. Indexing a large library can take time. File type discovery is not a codec guarantee; actual playback still depends on the device's decoder. Existing file pickers remain available for unindexed files and unsupported folder selection flows. The media stream rechecks permissions per request and uses bounded single-byte ranges with long offsets for seeking; >4GB range parsing has a JVM regression check in the Android workflow, while actual native seeking and very large movie playback remain device checks.

## Browser and desktop

**Choose media folder** imports the selected directory's supported file handles for this session, retaining nested relative folder names. Browsers cannot silently scan the whole device; use the system picker again after closing/reopening the section. Music album/artist tags are not inferred from filenames on this fallback. Existing individual/multiple file pickers remain available if a runtime lacks directory selection.

## Data and limits

The library metadata and thumbnail display are session-only. No broad Android manage-all-files or write permission is requested by discovery. Only an opened picture is copied into the existing editor; JPEG export limits and original preservation remain unchanged. Manual queue state and unsaved photo edits remain session-only. Device passphrase protection still gates entry, including non-server mode; library permission does not authenticate a server account.

Automated coverage: `src/lib/deviceMedia.test.ts` verifies preserved folder identity, music grouping, natural/metadata sorting, section filtering and photo size rejection. `scripts/test-login-entry.mjs` now exercises paged native bridge contracts, permission denial/full/limited states, grouping/search/sorting, real video/audio decoding and photo opening. Contract fixtures do not replace Android MediaStore permission and native content-URI acceptance on a physical device.
