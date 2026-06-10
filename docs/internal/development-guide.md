# Development and Production Deployment Guide

This guide describes the working process for changing the Immich Frame Controller, the Home Assistant integration, and the production Home Assistant add-on deployment.

The project has two runtime parts:

- Controller add-on: TypeScript/Fastify app in `src/`, packaged as the Home Assistant add-on in `immich_frame_controller/`.
- Home Assistant integration: Python custom integration in `custom_components/immich_frame/`.

The add-on and integration are separate, but they should usually be released together with the same version number.

## Repository Map

```text
src/                         Controller server and frame runtime
test/                        Vitest controller API tests
custom_components/immich_frame/
                             Home Assistant integration entities, config flow, services
immich_frame_controller/     Home Assistant add-on metadata and docs
docs/                        PRDs and development documentation
.github/workflows/docker.yml GHCR image build for the controller add-on
```

Important files:

```text
package.json
package-lock.json
immich_frame_controller/config.yaml
custom_components/immich_frame/manifest.json
```

Keep all four version values aligned for normal releases.

## Change Workflow

1. Start from a clean worktree.

```bash
git status --short
git pull --ff-only origin main
```

2. Read the affected code before editing.

For controller changes, start with:

```bash
rg -n "route|command|remote|frame|state" src test
```

For integration changes, start with:

```bash
rg -n "entity|async_setup_entry|coordinator|service|unique_id" custom_components/immich_frame
```

3. Make the smallest coherent change.

Controller-facing contracts should be covered by `test/server.test.ts`. Integration changes should preserve existing entity unique IDs unless the entity is intentionally replaced.

4. Bump the release version.

```bash
npm version <next-version> --no-git-tag-version
```

Then manually update:

```text
immich_frame_controller/config.yaml
custom_components/immich_frame/manifest.json
```

Use the same version as `package.json`.

## Validation

Run these before committing production-bound changes:

```bash
npm run typecheck
npm test
npm run build
python3 -m py_compile custom_components/immich_frame/*.py
git diff --check
```

Expected result:

- TypeScript compiles without errors.
- Vitest passes.
- Python integration files compile.
- `git diff --check` reports no whitespace errors.

For frontend/controller UI changes, also open the controller console in a browser and verify the affected view:

```text
http://127.0.0.1:<controller-port>/
```

For device-control changes, avoid triggering real screen or power commands unless that is the explicit test goal. Prefer checking `/api/frames/<device-id>/remote/status` first.

## Commit and Push

Review the diff:

```bash
git diff --stat
git diff
```

Commit:

```bash
git add <changed-files>
git commit -m "<short imperative summary>"
git push origin main
```

Pushing to `main` triggers `.github/workflows/docker.yml` when controller or add-on files changed.

The workflow builds and pushes:

```text
ghcr.io/hyungyunlim/immich-ha-sa:<package-version>
ghcr.io/hyungyunlim/immich-ha-sa:latest
```

Watch the build:

```bash
gh run list --repo hyungyunlim/immich-ha-sa --branch main --limit 5
gh run watch <run-id> --repo hyungyunlim/immich-ha-sa --exit-status
```

## Production Add-on Update

The production Home Assistant instance uses the add-on slug:

```text
e2ffcf58_immich_frame_controller
```

Never put production passwords, controller tokens, Immich API keys, or SSH passwords in git-tracked files.

Reload the Home Assistant add-on store and check the available version:

```bash
ha store reload
ha apps info e2ffcf58_immich_frame_controller --raw-json \
  | jq "{version:.data.version, latest:.data.version_latest, update_available:.data.update_available, state:.data.state}"
```

If `update_available` is true, update the add-on:

```bash
ha apps update e2ffcf58_immich_frame_controller
```

Then verify:

```bash
ha apps info e2ffcf58_immich_frame_controller --raw-json \
  | jq "{version:.data.version, latest:.data.version_latest, update_available:.data.update_available, state:.data.state}"
```

Check controller health with the configured controller API token:

```bash
curl -fsS \
  -H "Authorization: Bearer <controller-api-token>" \
  http://<ha-host>:8082/api/health \
  | jq .
```

If accessing HA over SSH from a workstation, keep the secret outside the command history:

```bash
read -rs SSHPASS
export SSHPASS
sshpass -e ssh root@<ha-host> '<ha-command>'
unset SSHPASS
```

Do not paste real secrets into docs, commits, issue comments, or PR descriptions.

## Integration Production Update

The integration is installed through HACS as a custom repository.

Integration code changes require Home Assistant Core to reload the Python integration code. In practice, use a HA Core restart after updating integration files through HACS.

Controller-only changes do not require HA Core restart. Updating/restarting the add-on is enough.

Use this distinction:

```text
Controller TypeScript or add-on config changed:
  - GitHub Actions image build
  - HA add-on update
  - No HA Core restart required

custom_components/immich_frame changed:
  - HACS update or manual file update
  - HA Core restart required

Both changed:
  - HA add-on update
  - HACS update if needed
  - HA Core restart after integration files are updated
```

Restart HA Core only when needed:

```bash
ha core restart
```

After restart, inspect:

```bash
ha core logs --lines 200
```

Then verify the integration device page and entity availability in Home Assistant.

## Post-Deploy Checks

After a production update, check these in order:

1. Add-on version equals latest and state is `started`.
2. `/api/health` returns `success: true`.
3. Immich album and person caches are not stale unless Immich is offline.
4. Frame state endpoint works:

```bash
curl -fsS \
  -H "Authorization: Bearer <controller-api-token>" \
  http://<ha-host>:8082/api/frame/<device-id>/state \
  | jq .
```

5. FreeKiosk remote status works for configured devices:

```bash
curl -fsS \
  -H "Authorization: Bearer <controller-api-token>" \
  http://<ha-host>:8082/api/frames/<device-id>/remote/status \
  | jq "{baseUrl:.data.baseUrl, source:.data.source, screen:.data.status.screen, audio:.data.status.audio}"
```

6. Controller logs show no repeated errors:

```bash
ha apps logs e2ffcf58_immich_frame_controller --lines 200
```

7. The physical frame still loads its stable URL:

```text
http://<ha-host>:8082/f/<frame-alias>
```

or the configured external tunnel URL.

## Operational Notes

### Controller Logs

Use add-on logs for command-level debugging:

```bash
ha apps logs e2ffcf58_immich_frame_controller --lines 200
```

Device command logs should include the device ID, command, resolved endpoint, resolved FreeKiosk base URL, source, and any screen-off preparation result.

### Device Commands

For FreeKiosk devices, screen, brightness, volume, mute, and key commands go through the configured or auto-discovered FreeKiosk REST API URL.

Before changing device-control code, test against mocked endpoints in `test/server.test.ts`. Only then test on a real frame.

### Screen Off Behavior

Screen-off behavior should be deterministic:

1. Read `/api/status`.
2. Capture brightness for later restore when available.
3. Set device volume to `0` if the frame is not already muted.
4. Send `/api/screen/off`.

Avoid relying on Android mute key toggles for screen-off preparation because toggle state is hard to infer reliably across devices.

### Version Discipline

Use one version for a release, even if only one side changed. This keeps HA add-on version, HACS manifest version, GitHub image tag, and package metadata easy to reason about.

For quick local experiments that will not be deployed, do not bump the version.

### When Not To Deploy

Do not update production if:

- GitHub Actions image build failed.
- Controller tests fail.
- HA integration Python files do not compile.
- The change touches entity unique IDs without a migration plan.
- The change modifies physical device commands and has not been tested with mocked endpoints.
