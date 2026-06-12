import { registerPlugin } from '../registry';

export const SwaggerPlugin = {
  id: 'swagger',
  name: 'Swagger / OpenAPI',
  version: '1.0.0',
  icon: '📄',
  description:
    'Import Swagger / OpenAPI specifications as collections and publish API specs in OpenAPI 3.0 format.',
  author: 'built-in',

  // Swagger extends the Collections sidebar with two actions:
  //   • Import → Swagger / OpenAPI  (in the ImportMenu dropdown)
  //   • Publish as Swagger          (in CollectionTree's overflow menu)
  // No dedicated sidebar tab or workspace panel — it augments existing UI.
  providesCollectionImport: true,
  providesCollectionPublish: true,
};

registerPlugin(SwaggerPlugin);
