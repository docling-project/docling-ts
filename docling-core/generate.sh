# Derive types from latest docling release.
poetry add --dev docling-core@latest
poetry run pydantic2ts --module docling_core.types --output src/types/models.ts
npm run lint:fix
