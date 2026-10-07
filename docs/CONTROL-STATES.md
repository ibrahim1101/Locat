# Messaging control states

Locat keeps unavailable controls visible when that helps explain what changed, and
removes the composer only when the current view cannot safely send anything.

| State | Text | Image/file | Voice | User-facing result |
| --- | --- | --- | --- | --- |
| Normal conversation | Enabled | Enabled | Enabled | Empty text keeps only the text-send button disabled. |
| Contact blocked | Disabled | Disabled | Disabled | Controls remain visible and explain that direct messaging is unavailable until unblocked. |
| Hidden-messages view | Not shown | Not shown | Not shown | A status tells the user to return to regular messages. |
| Former group member / archived | Not shown | Not shown | Not shown | Local history stays available with an archived explanation. |
| Group key rotation required | Not shown | Not shown | Not shown | Sending stays paused until the owner rotates the key. |
| Voice recording in progress | Text send disabled | Existing recording controls remain | Stop/send enabled | The recording timer and stop action remain available. |

Disabled controls expose the same reason through accessible descriptions and
tooltips. Server authorization and encryption checks remain authoritative; this
interface state is not a security boundary.

## Physical acceptance checklist

1. Open a normal direct and group chat. Confirm text, image, file and voice controls
   work; confirm the text send button enables only after non-whitespace input.
2. Block a direct contact. Confirm all compose controls stay visible but disabled,
   and the reason is readable. Unblock and confirm they recover without reloading.
3. Open Hidden messages. Confirm the composer is replaced by the return guidance.
4. On a disposable multi-account group, remove one member and confirm that account
   sees retained history plus the archived explanation and cannot send.
5. Trigger group-key rotation with disposable accounts. Confirm sending is paused,
   then rotate from Group details and verify every control recovers.
6. Repeat with keyboard navigation and a screen reader on both narrow and desktop
   layouts. Confirm disabled-control reasons are announced and focus order remains
   logical.
