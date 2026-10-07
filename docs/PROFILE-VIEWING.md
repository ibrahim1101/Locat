# Profiles and mobile Firefox checks

Click your own profile circle to edit your picture, nickname and bio. Enable “Allow people who can see my picture to download it” and save if you want Locat to offer a download button. This setting defaults to off. It cannot prevent screenshots or browser-level saving of a visible picture.

Click the other person's circle in a direct chat to see their current profile. Group member rows also open profiles. Profile visibility and blocking are checked on the server. Downloads check permission again when clicked, so a previously opened dialog cannot bypass a later permission change. The downloadable picture is the stored profile thumbnail.

After updating the server, close and reopen Locat on Firefox mobile without clearing browser data. Test these with two different accounts:

1. Upload a profile picture and send a chat image; both should decode and display.
2. Open the friend's profile and check nickname, username, LC code and bio according to their privacy settings.
3. Enable picture downloads on the owner's profile; reopen the friend's profile and download the picture. Turn permission off and verify downloads are denied, including from an already open dialog.
4. Export an encrypted chat backup and verify Firefox saves the file.
5. Test notifications using the steps in [NOTIFICATIONS.md](NOTIFICATIONS.md), first with the app visible, then in the background and after closing it.

Automated tests cover decoder fallback, download URL lifetime, push account checks and profile permission enforcement. Physical Firefox mobile testing remains required.
