import fs from 'node:fs/promises';
import path from 'node:path';
import { imagesDir, readSnapshot, websiteRoot } from './local-data-lib.mjs';

const { data, manifest } = await readSnapshot();
const contentRoot = path.join(websiteRoot, 'content', 'mensajeros');
const imageRoot = path.join(websiteRoot, 'static', 'img', 'mensajeros');
const marker = '.generated-by-field-report';

async function resetGenerated(directory) {
  try {
    await fs.access(directory);
    try {
      await fs.access(path.join(directory, marker));
    } catch {
      throw new Error(`No se reemplazó ${directory} porque no contiene la marca de contenido generado.`);
    }
    await fs.rm(directory, { recursive: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, marker),
    'Este directorio se genera con npm run site:prepare.\n',
  );
}

function requireImageInfo(imageId, profileId, kind = 'imagen aprobada') {
  const info = manifest.imageFiles?.[imageId];
  if (!info) {
    throw new Error(
      `Falta la ${kind} ${imageId} de ${profileId}. Ejecuta npm run data:export.`,
    );
  }
  return info;
}

const completeIds = new Set(
  data.people
    .filter(
      (person) =>
        person.informationStatus === 'Completo' &&
        person.photoStatus === 'Completo' &&
        person.reportStatus === 'Completo',
    )
    .map((person) => person.id),
);

const profiles = Object.entries(data.publishedProfiles || {})
  .filter(([id, profile]) => profile.verified === true && completeIds.has(id))
  .map(([, profile]) => profile);

// Validate every approved local image before replacing the last good public output.
const requiredSources = new Map();
for (const profile of profiles) {
  for (const photo of profile.photos) {
    if (!photo.imageId) continue;
    const info = requireImageInfo(photo.imageId, profile.id);
    requiredSources.set(
      path.join(imagesDir, info.filename),
      `${profile.id}: ${info.filename}`,
    );
  }
  if (profile.fundingImageId) {
    const info = requireImageInfo(profile.fundingImageId, profile.id, 'imagen QR aprobada');
    requiredSources.set(
      path.join(imagesDir, info.filename),
      `${profile.id}: ${info.filename}`,
    );
  }
}

const missingSources = [];
for (const [sourcePath, label] of requiredSources) {
  try {
    await fs.access(sourcePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    missingSources.push(label);
  }
}

if (missingSources.length > 0) {
  throw new Error(
    `No se reemplazó el sitio público porque faltan imágenes exportadas:\n- ${missingSources.join(
      '\n- ',
    )}\nEjecuta npm run data:export y vuelve a ejecutar npm run site:prepare.`,
  );
}

await resetGenerated(contentRoot);
await resetGenerated(imageRoot);
await fs.writeFile(
  path.join(contentRoot, '_index.md'),
  '---\ntitle: "Mensajeros CGV"\ntype: "mensajeros"\n---\n',
);

for (const profile of profiles) {
  const profileDir = path.join(contentRoot, profile.id);
  const publicImageDir = path.join(imageRoot, profile.id.toLowerCase());
  await fs.mkdir(profileDir, { recursive: true });
  await fs.mkdir(publicImageDir, { recursive: true });

  const photos = [];
  for (const photo of profile.photos) {
    let src = photo.externalUrl;
    if (photo.imageId) {
      const info = requireImageInfo(photo.imageId, profile.id);
      await fs.copyFile(
        path.join(imagesDir, info.filename),
        path.join(publicImageDir, info.filename),
      );
      src = `/img/mensajeros/${profile.id.toLowerCase()}/${info.filename}`;
    }
    photos.push({
      id: photo.id,
      src,
      caption: photo.caption,
      location: photo.location,
      credit: photo.credit,
    });
  }

  const heroPhoto = photos.find((photo) => photo.id === profile.heroPhotoId) || photos[0];
  const galleryPhotos = photos.filter((photo) => photo.id !== heroPhoto?.id);
  let fundingImage = '';
  if (profile.fundingImageId) {
    const info = requireImageInfo(profile.fundingImageId, profile.id, 'imagen QR aprobada');
    await fs.copyFile(
      path.join(imagesDir, info.filename),
      path.join(publicImageDir, info.filename),
    );
    fundingImage = `/img/mensajeros/${profile.id.toLowerCase()}/${info.filename}`;
  }

  const frontMatter = {
    title: profile.name,
    type: 'mensajeros',
    layout: 'single',
    url: `/mensajeros/${profile.id}/`,
    mensajeroId: profile.id,
    role: profile.role,
    location: profile.location,
    city: profile.city || '',
    country: profile.country || '',
    commendingChurch: profile.commendingChurch || '',
    commendingChurchUrl: profile.commendingChurchUrl || '',
    bio: profile.bio,
    summary: profile.summary,
    fundingLabel: profile.fundingLabel,
    fundingUrl: profile.fundingUrl,
    fundingImage,
    heroImage: heroPhoto?.src || '',
    photos: galleryPhotos,
    publishedAt: profile.publishedAt,
  };
  await fs.writeFile(
    path.join(profileDir, 'index.md'),
    `${JSON.stringify(frontMatter, null, 2)}\n`,
  );
}

console.log(`${profiles.length} perfiles públicos preparados en content/mensajeros/.`);
console.log(
  'Solo se generaron datos aprobados. Revisa los cambios y luego usa Git para publicar el sitio.',
);
