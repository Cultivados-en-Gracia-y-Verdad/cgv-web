---
title: "Descargas"
date: 2026-07-14T00:00:00-04:00
draft: false
image: "img/cgv-logo.jpg"
---

<section class="download-page">
  <p class="lead">
    Descargue CGV Presenter para usar cursos, presentaciones, canciones y cuestionarios desde una computadora local.
  </p>

  <div class="download-grid">
    <article class="download-card">
      <h2>macOS</h2>
      <p>Para computadoras Mac con Apple Silicon.</p>
      <a id="cgv-presenter-macos-download" class="download-button" href="https://github.com/Cultivados-en-Gracia-y-Verdad/herramientas/releases/download/CGV-Presenter-v1.1.16/CGV-Presenter-macOS-arm64-1.1.16.zip">
        Descargar para macOS
      </a>
      <small id="cgv-presenter-macos-version">Versión 1.1.16 · ZIP</small>
    </article>
    <article class="download-card">
      <h2>Windows</h2>
      <p>Para computadoras Windows.</p>
      <a id="cgv-presenter-windows-download" class="download-button" href="https://github.com/Cultivados-en-Gracia-y-Verdad/herramientas/releases/download/CGV-Presenter-v1.1.16/CGV.Presenter-1.1.16.Setup.exe">
        Descargar para Windows
      </a>
      <small id="cgv-presenter-windows-version">Versión 1.1.16 · EXE</small>
    </article>
  </div>

  <p class="download-note">
    CGV Presenter funciona offline. Después de instalarlo, los cursos pueden descargarse y usarse localmente sin depender del internet durante la enseñanza.
  </p>

  <p>
    <a class="download-button" href="/cgv-presenter/">
      Ver manual de uso
    </a>
  </p>
</section>

<script>
(() => {
  // Do not use /releases/latest — that can be BLE+ or another non-Presenter tag.
  const releasesApiUrl = "https://api.github.com/repos/Cultivados-en-Gracia-y-Verdad/herramientas/releases?per_page=30";
  const versionPattern = /^CGV-Presenter-v(.+)$/;
  const macLink = document.getElementById("cgv-presenter-macos-download");
  const macVersion = document.getElementById("cgv-presenter-macos-version");
  const windowsLink = document.getElementById("cgv-presenter-windows-download");
  const windowsVersion = document.getElementById("cgv-presenter-windows-version");

  const getVersion = release => {
    const match = String(release.tag_name || "").match(versionPattern);
    return match ? match[1] : "";
  };

  const findAsset = (assets, pattern) => assets.find(asset => pattern.test(asset.name || ""));

  const pickPresenterRelease = releases => {
    if (!Array.isArray(releases)) return null;
    return releases.find(release =>
      !release.draft
      && !release.prerelease
      && versionPattern.test(String(release.tag_name || ""))
    ) || null;
  };

  fetch(releasesApiUrl, { headers: { "Accept": "application/vnd.github+json" } })
    .then(response => response.ok ? response.json() : Promise.reject(new Error("release unavailable")))
    .then(releases => {
      const release = pickPresenterRelease(releases);
      if (!release) throw new Error("no presenter release");

      const assets = Array.isArray(release.assets) ? release.assets : [];
      const version = getVersion(release);
      const macAsset = findAsset(assets, /(?:mac|darwin).*\.zip$/i);
      const windowsAsset = findAsset(assets, /\.(?:exe|msi)$/i);

      if (macAsset && macLink && macVersion) {
        macLink.href = macAsset.browser_download_url;
        macVersion.textContent = `Versión ${version} · ZIP`;
      }

      if (windowsAsset && windowsLink && windowsVersion) {
        windowsLink.href = windowsAsset.browser_download_url;
        windowsVersion.textContent = `Versión ${version} · ${windowsAsset.name.split(".").pop().toUpperCase()}`;
      }
    })
    .catch(() => {
      // Keep the hard-coded fallback links visible if GitHub cannot be reached.
    });
})();
</script>
