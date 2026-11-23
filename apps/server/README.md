# Site server

NestJS app that runs on each site server: staff logins, the queue engine and live updates.

## API (sprint 1)

All routes need a staff login (session cookie) unless marked public.

| Method and path                | What it does                                                    |
| ------------------------------ | --------------------------------------------------------------- |
| `GET /health` (public)         | Database reachable                                              |
| `POST /auth/login` (public)    | Email and password; sets the `dz_session` cookie                |
| `POST /auth/logout` (public)   | Clears the cookie                                               |
| `GET /auth/me`                 | The signed-in user                                              |
| `POST /auth/password`          | Set own password (required first when `mustSetPassword`)        |
| `GET /setup/branch`            | Branch, wording, priority reasons, services, counters           |
| `GET /queue`                   | Waiting count and estimate per service                          |
| `POST /tickets`                | Issue a ticket: service, optional priority reason, extra fields |
| `POST /tickets/:id/recall`     | Call a called ticket again                                      |
| `POST /tickets/:id/start`      | Patient arrived                                                 |
| `POST /tickets/:id/no-show`    | Patient did not come                                            |
| `POST /tickets/:id/done`       | `{choice: next \| stage \| end}`; moves to the next stage       |
| `POST /tickets/:id/cancel`     | Cancel a waiting or called ticket                               |
| `GET /counters/:id`            | Counter, current ticket, waiting list in call order             |
| `POST /counters/:id/sign-in`   | Take this counter and open it                                   |
| `POST /counters/:id/pause`     | Pause (break)                                                   |
| `POST /counters/:id/resume`    | Open again                                                      |
| `POST /counters/:id/sign-out`  | Close and leave                                                 |
| `POST /counters/:id/call-next` | Call the next ticket for the counter's services                 |

Logins are limited: 5 failures for one email from one address, or 20 from one address, block
further attempts for 15 minutes. Logins, failed logins, password changes and setting changes go
to `audit_log`.

Socket.IO on the same port: a staff browser connects with its session cookie and joins its
branch room. Event names are in `@dozbyte/shared` (`SocketEvents`); screens refetch on each event.

## Environment

| Variable         | Default                 | Notes                                          |
| ---------------- | ----------------------- | ---------------------------------------------- |
| `DATABASE_URL`   | (required)              | PostgreSQL connection string                   |
| `PORT`           | `3001`                  |                                                |
| `SESSION_SECRET` | random per start in dev | Required in production, at least 32 characters |
| `WEB_ORIGIN`     | `http://localhost:3000` | Origin of the web app, for CORS and sockets    |
| `SITE_TIMEZONE`  | `Africa/Lagos`          | Ticket numbers restart at local midnight       |
