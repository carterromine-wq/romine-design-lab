# Mr. Romine’s Technology Class — Figma Design Lab

A standalone classroom app with teacher-created student accounts, saved progress, and a guided course that opens one step at a time. Students do not need ChatGPT or an email address to sign in. They use their separate, school-approved Figma accounts to complete design work.

## Publish on Render

This folder is ready to deploy as a **Render web service**. The included `render.yaml` sets up the app and the disk that stores accounts and progress.

### Hosting cost

The Blueprint selects Render’s paid **0.5c-512mb** compute plan (formerly Starter) and a **1 GB persistent disk**. At the published rates checked on November 17, 2026, the base cost is **about $7.25 per month**: $7 for the service plus $0.25 for the disk. Usage, taxes, or a paid Render workspace can add to that amount. Review the price Render displays before deploying. [Render pricing](https://render.com/pricing) · [Compute plan names](https://render.com/docs/compute-plans-update)

The disk is essential: this app stores its SQLite database under `/var/data`. Render’s ordinary filesystem is temporary; a service without the persistent disk would lose locally stored accounts and progress after a restart or deploy. Persistent disks require a paid service. [Render persistent disks](https://render.com/docs/disks)

### 1. Put the project in GitHub

1. Unzip the download.
2. Create a GitHub repository for the app. A private repository is fine.
3. Upload the **contents** of this project folder and commit them. `package.json` and `render.yaml` should appear at the repository’s top level.
4. Keep `package-lock.json` in the repository. Do not upload `node_modules`, `dist`, `.env`, a `data` folder, or any student credentials/database files.

### 2. Create the Render app

1. Sign in to [Render](https://dashboard.render.com/).
2. Select **New → Blueprint** and connect the repository you just created.
3. Select the branch containing the project. Leave the Blueprint path as `render.yaml`.
4. When prompted for **TEACHER_PASSWORD**, enter a unique password of at least 12 characters. Save it in your password manager.
5. Review the paid service and disk, then select **Deploy Blueprint**.
6. Wait for the service to become live, then open the `onrender.com` address shown by Render.

Render prompts for the password because the Blueprint marks that environment variable `sync: false`; the secret is not included in the source code. [Blueprint setup](https://render.com/docs/infrastructure-as-code) · [Secret environment variables](https://render.com/docs/blueprint-spec#prompting-for-secret-values)

### 3. Create student logins

Sign in to the app with:

- **Username:** `mrromine`
- **Password:** the teacher password you entered in Render

Open the teacher dashboard and create student accounts. Use school identifiers or simple usernames such as `period3-01`. Usernames use 3–40 lowercase letters, numbers, periods, underscores, or hyphens; display names can be 1–80 characters. Each account receives its own generated password. Save the generated credentials when they appear and give each student only their own login. The app does not email passwords or require students to create third-party accounts.

Use the teacher dashboard to reset a forgotten password or disable an account. See [TEACHER_GUIDE.md](docs/TEACHER_GUIDE.md) for everyday classroom use.

### 4. Check your classroom setup

Before the first lesson, create one test student account and use it to check:

1. The student can sign in on a school computer.
2. Only the first unfinished lesson and its available step can open.
3. The official YouTube tutorial plays on the school network.
4. A saved task or note remains after signing out and signing back in.
5. The companion Figma file opens with the student’s approved Figma account.

Use the final Render address in Google Classroom. The earlier `chatgpt.site` version is a separate deployment and does not receive these changes or share this version’s accounts/progress.

## How the course works

There are 10 lessons in Figma’s original sequence: frames, shapes, typography, geometry, the Pen tool, vector brushes, simple animations, loading animations, and two prototyping lessons.

Every lesson follows **Learn → Watch → Build → Check**. A later step stays locked until its prerequisite is complete. Build tasks are completed in order, and the next lesson opens only after the current lesson passes its completion requirements. Completed material remains available for review.

The watch step uses a simplified YouTube player with play/pause controls and no in-app seek bar, speed selector, or “mark watched” checkbox. Playback progress is saved so a student can continue during another class period. The server checks sequential playback reports against elapsed time; jumping to the end does not complete the watch step. Paused or hidden playback does not earn viewing progress.

YouTube retains control of its embedded player and links. This discourages skipping inside the course; it cannot prove a student was paying attention or make an embedded YouTube video impossible to manipulate. For a blocked tutorial or an approved accommodation, the teacher can record a reason and approve that student’s watch step.

The app stores course progress and links to student work. Figma stores the actual designs. Saving a link here does not submit an assignment to Google Classroom.

## Manual Render settings

Use these only if you choose **New → Web Service** instead of the Blueprint:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Compute plan | `0.5c-512mb` / legacy Starter or larger paid plan |
| Instance count | 1 |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Persistent disk | 1 GB, mounted at `/var/data` |
| `NODE_VERSION` | `24.22.1` |
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/var/data` |
| `TEACHER_USERNAME` | `mrromine` |
| `TEACHER_PASSWORD` | Your unique password, at least 12 characters |

Render provides the listening port through `PORT`; leave that environment variable to Render. If you later add a custom domain, set `PUBLIC_ORIGIN` in Render to its exact HTTPS origin, such as `https://design.school.example`, and use that address consistently. Without an override, the app uses Render’s automatically supplied `RENDER_EXTERNAL_URL`. This origin check protects account and progress changes. This SQLite edition runs as one service instance. A persistent disk cannot be shared across scaled instances. [Render Blueprint fields](https://render.com/docs/blueprint-spec) · [Node version selection](https://render.com/docs/node-version)

## Run locally

Install Node **24.22.1**, then from this folder:

```bash
npm ci
npm run build
```

Copy `.env.example` to `.env` and set a teacher password. Start the built app with:

```bash
node --env-file=.env dist/server.mjs
```

Open `http://localhost:3000`. Local accounts and progress are stored in `data/`, which is excluded from Git. Local test data is separate from the Render deployment.

## Maintenance

- Keep `/var/data` and its persistent disk attached through redeployments.
- Schedule updates outside class; a service with a persistent disk can have a brief interruption during deployment.
- Preserve your database when moving the app to another service. Copying the source code alone does not copy student accounts or progress.
- Keep teacher credentials and exported student logins private. A password reset is the supported way to issue a replacement student password.
- Before changing the database or moving hosting, use the teacher dashboard’s database backup download. The app creates a consistent SQLite snapshot of `course.sqlite`; copying a live database file by itself can miss its write-ahead log.
- Keep backups private: they contain accounts, password hashes, and student work records. Recovery requires stopping the app and restoring a validated snapshot as `/var/data/course.sqlite`; arrange that migration before deleting the original service or disk.

## Course sources and attribution

Tutorial videos and companion files are provided by **Figma** and linked from its [K–12 design basics course](https://www.figma.com/resource-library/k-12-design-basics/). Videos remain hosted on YouTube; the app does not download or redistribute them. The classroom checklists, reflection prompts, guided flow, and Mr. Romine branding are additions for this class.

The player uses the official [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) and its documented [player parameters](https://developers.google.com/youtube/player_parameters).
