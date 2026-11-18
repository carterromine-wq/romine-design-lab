# Set up student Google sign-in

The app supports Google's official sign-in button alongside class-code/password signup. Google sign-in becomes available after you configure a web client ID. Your teacher account continues to use `mrromine` and its existing password.

This implementation uses Google Identity Services to obtain an ID token and verifies it on the server. It uses basic account identity for student login; it does not request access to Gmail, Drive, Google Classroom, or a student's files. A Google client secret is not used by this flow.

## 1. Create the Google web client

Use a school-managed Google Cloud project if school IT provides one.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create the project for this app.
2. In **Google Auth Platform**, configure **Branding** with the app name **Mr. Romine's Design Lab**, a school-approved support contact, and any homepage/privacy information Google requests. Use actual school-approved information.
3. In **Audience**, choose **Internal** only when the project belongs to your school's Google Cloud Organization and the intended accounts belong to that organization. Otherwise choose **External**. **Personal** is unsuitable for a class because only the project's creator can use it.
4. In **Data Access**, use the basic identity scopes `openid`, email, and profile. This app does not need additional Google API scopes.
5. Open **Clients → Create client**. Select **Web application**.
6. Add this exact **Authorized JavaScript origin**:

   ```text
   https://mr-romine-design-lab-ndj5.onrender.com
   ```

7. Create the client and copy its **Client ID**, which ends in `.apps.googleusercontent.com`.

The origin contains the scheme and hostname, with no path. This app uses a JavaScript callback in the Google popup flow, so it does not need an Authorized redirect URI. [Google setup documentation](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)

Google's basic Sign in with Google requests are exempt from the normal External/Testing requirements to list every test user and from the seven-day consent expiration. Adding other OAuth scopes can remove that exception. Google's publishing and verification requirements still depend on the project's configuration; use the status Google displays for that project. [Google audience settings](https://support.google.com/cloud/answer/15549945?hl=en)

## 2. Add the client ID to Render

Open the existing **mr-romine-design-lab-ndj5** service in Render and go to **Environment**.

| Environment variable | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | The complete web client ID from Google |
| `GOOGLE_ALLOWED_DOMAIN` | Optional: the exact Google Workspace hosted domain permitted for students |

Save and deploy the service with the new settings. Keep the existing teacher password, data directory, and persistent disk. The login page will then show Google's button.

The client ID is a public identifier used by the browser; do not enter the client secret in its place. The class code stays in the teacher dashboard and should not be added to GitHub or to a public URL.

Ask school IT for the actual student Google Workspace hosted domain before setting `GOOGLE_ALLOWED_DOMAIN`; it may differ from the teacher's email domain. This option validates Google's `hd` claim, which identifies a managed domain. It applies to Google sign-in and linking; regular class-code/password registration remains available. Omitting the variable permits Google accounts from other domains, while new accounts still require the class code. [Google domain verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

If you later use a custom domain, add its exact HTTPS origin to the Google client and update the app's `PUBLIC_ORIGIN` in Render. Use that address consistently.

## 3. Ask school IT to allow student access if needed

Google Workspace for Education can block apps for student accounts even when a teacher can sign in. Google's guidance specifically calls out administrator approval for students under 18 using unconfigured apps. [Student app requests](https://support.google.com/edu/classroom/answer/15163043?hl=en)

Give IT the app name, website, and **OAuth client ID**. An administrator can use **Security → Access and data control → API controls → Manage App Access → Configure new app**, find the client ID, and configure access for the intended student organizational units. The **Specific Google data** setting can allow the required basic sign-in scopes. IT should select the appropriate access policy for the school. [Google administrator instructions](https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data)

## 4. Use Google without losing existing progress

**New student:** Select **Create account**, enter the class code, and choose Google. The app creates a student account and adds it to the teacher roster. Later, use Google from **Sign in** without entering the class code again.

**Existing student:** Sign in to the original course account with its username and password, open **Resources & help**, and select **Connect Google**. Future Google sign-ins will open that same account and its saved progress.

A Google identity can be attached to only one course account. Creating another account is not a way to transfer progress. Disabled course accounts stay disabled even if Google authentication succeeds. Closing class signup stops new accounts; existing linked students can still sign in.

## 5. Check before using it with a whole class

On a student school computer, test one new signup with the class code, then sign out and sign in with Google again. Also test linking an existing account that has a saved note and confirm that the note remains. Check the teacher roster to confirm each student has one account.

| Symptom | Check |
| --- | --- |
| No Google button | Confirm `GOOGLE_CLIENT_ID` is set on the existing Render service and the updated deployment is live. |
| Origin/client error from Google | Use a **Web application** client and verify the exact HTTPS Authorized JavaScript origin. |
| School account blocked | Ask IT to review the OAuth client and policy for the student's organizational unit. |
| Account is outside the allowed domain | Verify `GOOGLE_ALLOWED_DOMAIN` with IT. The app checks the managed hosted domain, not just the email suffix. |
| Google cannot load | Check school filtering or browser settings. Existing password logins and class-code/password signup remain available. |
| Google is already linked elsewhere | Return to the account that owns the Google link or ask for account assistance. No automatic merge is performed. |

Removing `GOOGLE_CLIENT_ID` and redeploying hides Google sign-in. Existing course accounts and progress remain. Google-only students would need a course password issued through the teacher dashboard to use password login.
