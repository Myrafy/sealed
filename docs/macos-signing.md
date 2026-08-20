# macOS code signing & notarization

Unsigned builds work, but Gatekeeper shows a warning until the user right-clicks → **Open**.  
To fix that for all users, sign with a **Developer ID Application** cert and **notarize** with Apple.

## What you need

1. [Apple Developer Program](https://developer.apple.com/programs/) membership (~$99/year)
2. A **Developer ID Application** certificate (not “Apple Development” / “Apple Distribution”)
3. Either:
   - Apple ID + [app-specific password](https://appleid.apple.com), or
   - App Store Connect API key (`.p8`) — better for CI

## 1. Create & export the signing certificate

On a Mac signed into your Developer account:

1. Open **Xcode → Settings → Accounts → Manage Certificates**
2. **+ → Developer ID Application**
3. Open **Keychain Access**, find `Developer ID Application: …`
4. Right-click → **Export…** → save as `sealed-developer-id.p12` with a strong password

Encode for GitHub:

```bash
base64 -i sealed-developer-id.p12 | pbcopy
```

## 2. Notarization credentials

### Option A — Apple ID (simple)

1. [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → **App-Specific Passwords** → generate one
2. Team ID: [developer.apple.com/account](https://developer.apple.com/account) → Membership details

### Option B — API key (recommended for CI)

1. [App Store Connect → Users and Access → Integrations → Team Keys](https://appstoreconnect.apple.com/access/integrations/api)
2. Create a key with **Developer** access, download `AuthKey_XXXX.p8` (once only)
3. Note **Key ID** and **Issuer ID**
4. Encode the key:

```bash
base64 -i AuthKey_XXXXXX.p8 | pbcopy
```

## 3. Add GitHub repo secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|--------|--------|
| `CSC_LINK` | Base64 of the `.p12` file |
| `CSC_KEY_PASSWORD` | Password you set when exporting the `.p12` |
| `APPLE_TEAM_ID` | 10-character Team ID |

**Plus either Option A:**

| Secret | Value |
|--------|--------|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |

**or Option B:**

| Secret | Value |
|--------|--------|
| `APPLE_API_KEY` | Base64 of the `.p8` file |
| `APPLE_API_KEY_ID` | Key ID |
| `APPLE_API_ISSUER` | Issuer UUID |

## 4. Publish a new release

```bash
# bump version in package.json first if needed
git tag v1.0.1
git push origin v1.0.1
```

The Release workflow will sign + notarize on `macos-latest` when `CSC_LINK` is present.

## Verify on a Mac

```bash
spctl --assess --verbose --type execute /path/to/Sealed.app
# expected: accepted
```

Or download the DMG and open normally — Gatekeeper should allow it without right-click.

## Notes

- Local unsigned `npm run build:mac` still works without these secrets.
- Notarization usually takes a few minutes per arch.
- Keep `.p12` / `.p8` out of git — secrets only.
