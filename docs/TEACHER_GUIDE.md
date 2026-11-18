# Teacher guide

## First day

1. Sign in with the teacher account: username `mrromine`, plus the password you set in Render.
2. Find **Join your class** in the teacher dashboard and copy its class code.
3. Post the [class website](https://mr-romine-design-lab-ndj5.onrender.com) and share the code with your students.
4. Have new students select **Create account** and enter the code, a display name, a username, and their own password. They appear in your roster automatically.
5. Students start the first lesson. Close signup when everyone has joined; you can reopen it for a new student.

Students need this course login and their school-approved Figma login. They do not need ChatGPT, a new email address, or access to your teacher account.

If Google sign-in has been configured, new students can use their school Google account and the class code instead of choosing a course password. The one-time setup is in [GOOGLE_SIGN_IN.md](GOOGLE_SIGN_IN.md).

## The student experience

The home screen emphasizes the current lesson. Later lessons remain locked, so students can focus on the next action. Completed lessons stay available for review.

| Stage | Student action | What unlocks next |
| --- | --- | --- |
| Learn | Read the lesson explanation and goals, then continue. | Watch |
| Watch | Play the official tutorial, pausing as needed to follow along in Figma. | Build, after the tutorial is verified complete |
| Build | Finish the Figma practice tasks in order. | The next task, then Check |
| Check | Complete the knowledge check, reflection, and Figma project link. | The next lesson, after all requirements are satisfied |

Students can stop partway through a lesson and return another day. They should wait for the saved status before signing out or closing the page. Each account keeps its own progress; using a different computer is fine when they sign in with the same credentials.

The task checklist records students’ reports of their work. The app does not inspect their Figma files or determine the quality of their design automatically. Review the project link when assessing the assignment.

## Suggested rhythm for a 35-minute class

- **Opening:** Students sign in and resume their current step.
- **Work time:** Students watch, pause, try the tools, and complete the assigned Figma practice.
- **Last few minutes:** Students save their Figma work, leave a short note about what to do next, wait for the course to show saved, and sign out.

There is no need to finish one entire lesson per period. The guided sequence and saved place are designed for work across several class meetings.

## Student accounts

### Student self-signup

Use the **Join your class** card to copy the website link or class code, open or close signup, and generate a replacement code. The code is an invitation to create a student account; it does not sign anyone into an existing account or grant teacher access.

Students choose a unique username with 3–40 lowercase letters, digits, periods, underscores, or hyphens and a password of 10–128 characters. A display name can be a first name, nickname, or school identifier. A full legal name and an email address are not required for username/password signup.

Keep one account per student. If the student already has a login, use **Sign in**. Creating another account starts a separate progress record. Closing signup or changing the invitation code preserves all existing accounts and progress; it only changes who can create a new account.

### Google sign-in and existing progress

The Google button appears when the school's Google client ID is configured in Render. A new student uses **Create account**, enters the class code, and chooses Google. On later visits, that student can use Google from **Sign in** without the invitation code, even if new signup is closed.

For a student who already has course work, have them sign in with their existing username and password, open **Resources & help**, and select **Connect Google**. This attaches Google to their current account and keeps their progress. The app does not merge accounts just because names or email addresses look similar.

Google is a student login option. Your teacher account still uses `mrromine` and the teacher password stored in Render. If the school blocks the Google app, ask school IT to approve the OAuth client for the student accounts; use the ordinary course login while that is being arranged. See [Google's student app-access guidance](https://support.google.com/edu/classroom/answer/15163043?hl=en).

### Create accounts manually

You can still create individual accounts or paste a roster into **Add students**. This is useful when a student cannot use self-signup. Usernames should be unique; a class period plus student number works well. Do not reuse one account for an entire class because progress belongs to the account.

Generated passwords are shown when an account is created or reset. Save or distribute them then; the server stores password hashes, not a readable password list.

### Forgotten password

Use the teacher dashboard’s password reset for that student. Give the student the new password privately. Resetting a password signs out existing sessions for that account and preserves the student’s course progress.

For Google login problems, the school's Google account recovery is separate from this app. A course password reset can provide a username/password login to the same course account; it does not change the student's Google password.

### Student leaves the class

Disable the account. A disabled student cannot continue signing in. Their progress remains available to the teacher; disabling is different from deleting their work.

### Shared lab computers

Students should use **Sign out** at the end of class. Signing out of this app does not sign them out of Figma, so handle the Figma account separately as needed. The next student should check the displayed name before starting work.

## Videos and accommodations

The course removes the in-app seek bar and playback-speed selector. It provides play/pause controls, requests captions, and records sequential viewing. Skipping ahead does not count as completing the watch step. Watching a tutorial in a separate YouTube tab does not earn progress in this app.

Students may pause as often as needed. If they leave the course tab, playback pauses and viewing credit stops. On return, playback resumes from saved progress, so a lesson can span several days.

YouTube can still display its own branding, notices, or links. The player does not make videos tamper-proof, and recorded playback cannot prove attention. The practical controls are the guided sequence, server-checked progress, and the Figma tasks that follow.

If a video is blocked, unavailable, or unsuitable for a student’s access needs, use the teacher dashboard to approve the **current lesson’s watch step** for that student and record a meaningful reason. For example: “Viewed with the class on the SmartBoard” or “Completed the teacher-led demonstration.” This approval unlocks Build; it does not complete the remaining tasks or skip the whole course.

For a network block, ask school IT to review the course’s Render domain and the official YouTube/Figma resources. Test on a student account and student device because school filtering may differ from your teacher account.

## Reviewing work

The teacher dashboard shows student progress and the saved evidence for each lesson. Use the student’s Figma link to inspect the actual project. Students still need to grant you access through Figma’s school-approved sharing settings.

The course includes checks and completion requirements; it is not an automatic grading system or a Google Classroom integration. If you want a Classroom submission too, direct students to turn in the Figma link there.

## Keeping progress safe

The Render persistent disk is the source of saved accounts and progress. Keep it attached at `/var/data` when updating the app. Do not deploy this SQLite edition as a free service or a static site.

A redeploy of the same service with the same disk preserves progress. A newly created Render service starts with a separate, empty database unless you migrate the existing database. The older ChatGPT-hosted version has its own account system and does not automatically transfer progress here.

Use **Download database backup** in the teacher dashboard before moving hosting or making major changes. Store the file privately; it contains account and progress records. It is a database snapshot for recovery, not a student handout.

If the teacher password must change, update `TEACHER_PASSWORD` in the Render service’s Environment settings and redeploy. Changing it revokes existing teacher sessions, so sign in again with the new password. Keep the teacher password out of GitHub and student-facing documents.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| The site will not start after deployment | Confirm `TEACHER_PASSWORD` has at least 12 characters, Node is 24.22.1, and the disk is mounted at `/var/data`. Read the Render deploy logs for the exact error. |
| A student cannot sign in | Check the username, account status, and password. Reset the student password if needed. |
| A new student cannot create an account | Check that signup is open, the current class code is correct, the username is available, and the password has at least 10 characters. |
| The Google button is missing | Google sign-in needs `GOOGLE_CLIENT_ID` in Render and a deployment with that setting. Ordinary signup and password login remain available. |
| Google says the app is blocked | Ask school IT to review the app's OAuth client and the student's organizational-unit policy. See the Google setup guide. |
| Google opens a fresh course instead of existing progress | Sign out, return to the original course account with its username/password, and use Resources & help → Connect Google. If Google was already attached to a second account, ask for account assistance; the app does not merge records automatically. |
| The next step is locked | Complete the current step. The video must finish through the course player, Build tasks must be checked in order, and Check requires all listed items. |
| The video will not play | Check the school filter, reload the page, and use the teacher video approval only after an appropriate alternative. |
| A saved project link is rejected | Use the full HTTPS link to the student’s own Figma design, file, or prototype—not a Community example or a folder link. |
| A save fails | Keep the page open and retry after the network returns. Do not assume the change saved until the saved status appears. |
| Progress seems missing | Confirm the student signed in to the same account and the same Render website. Check that the persistent disk and `DATA_DIR` setting were preserved. |

## Source material

The sequence, official videos, and companion Figma files come from [Figma’s K–12 design basics course](https://www.figma.com/resource-library/k-12-design-basics/). The teaching prompts and classroom activities support that material.
