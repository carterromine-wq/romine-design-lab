# Teacher guide

## First day

1. Sign in with the teacher account: username `mrromine`, plus the password you set in Render.
2. Create the student accounts in the teacher dashboard. Usernames should be unique; a class period plus student number works well.
3. Save the generated login list as soon as it appears. Give students only their own username and password.
4. Post the Render website address in Google Classroom.
5. Have students sign in and start the first lesson.

Students need this course login and their school-approved Figma login. They do not need ChatGPT, a new email address, or access to your teacher account.

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

### Create accounts

Create one account per student. A display name can be a first name, nickname, or school identifier; a full legal name is not necessary. Do not reuse one account for an entire class because progress belongs to the account.

Generated passwords are shown when an account is created or reset. Save or distribute them then; the server stores password hashes, not a readable password list.

### Forgotten password

Use the teacher dashboard’s password reset for that student. Give the student the new password privately. Resetting a password signs out existing sessions for that account and preserves the student’s course progress.

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
| The next step is locked | Complete the current step. The video must finish through the course player, Build tasks must be checked in order, and Check requires all listed items. |
| The video will not play | Check the school filter, reload the page, and use the teacher video approval only after an appropriate alternative. |
| A saved project link is rejected | Use the full HTTPS link to the student’s own Figma design, file, or prototype—not a Community example or a folder link. |
| A save fails | Keep the page open and retry after the network returns. Do not assume the change saved until the saved status appears. |
| Progress seems missing | Confirm the student signed in to the same account and the same Render website. Check that the persistent disk and `DATA_DIR` setting were preserved. |

## Source material

The sequence, official videos, and companion Figma files come from [Figma’s K–12 design basics course](https://www.figma.com/resource-library/k-12-design-basics/). The teaching prompts and classroom activities support that material.
