const openApiUrl =
  process.argv[2] ??
  process.env.DOCLING_OPENAPI_URL ??
  'http://localhost:5001/openapi.json';

const response = await fetch(openApiUrl, {
  headers:
    process.env.DOCLING_API_KEY === undefined
      ? {}
      : { 'X-Api-Key': process.env.DOCLING_API_KEY },
});

if (!response.ok) {
  throw new Error(
    `Could not fetch ${openApiUrl}: HTTP ${response.status} ${response.statusText}`
  );
}

const specification = await response.json();
assertObject(specification, 'OpenAPI document');
assertPath(specification, '/v1/convert/source/async', 'post');
assertPath(specification, '/v1/convert/file/async', 'post');
assertPath(specification, '/v1/convert/source/batch', 'post');
assertPath(specification, '/v1/chunk/hybrid/source/async', 'post');
assertPath(specification, '/v1/chunk/hybrid/file/async', 'post');
assertPath(specification, '/v1/chunk/hierarchical/source/async', 'post');
assertPath(specification, '/v1/chunk/hierarchical/file/async', 'post');
assertPath(specification, '/v1/status/poll/{task_id}', 'get');
assertPath(specification, '/v1/result/{task_id}', 'get');
assertPath(specification, '/health', 'get');
assertPath(specification, '/version', 'get');
assertJsonRequest(specification, '/v1/convert/source/async', 'post');
assertJsonRequest(specification, '/v1/convert/source/batch', 'post');
assertMultipartRequest(specification, '/v1/convert/file/async', 'post');
assertJsonRequest(specification, '/v1/chunk/hybrid/source/async', 'post');
assertMultipartRequest(specification, '/v1/chunk/hybrid/file/async', 'post');
assertJsonRequest(specification, '/v1/chunk/hierarchical/source/async', 'post');
assertMultipartRequest(specification, '/v1/chunk/hierarchical/file/async', 'post');
assertPathParameter(specification, '/v1/status/poll/{task_id}', 'get', 'task_id');
assertPathParameter(specification, '/v1/result/{task_id}', 'get', 'task_id');
assertRequestProperties(
  specification,
  '/v1/convert/source/async',
  'post',
  'application/json',
  ['sources', 'target', 'options', 'callbacks']
);
assertRequestProperties(
  specification,
  '/v1/convert/source/batch',
  'post',
  'application/json',
  ['sources', 'target', 'options', 'callbacks']
);
assertRequestProperties(
  specification,
  '/v1/convert/file/async',
  'post',
  'multipart/form-data',
  ['files', 'target_type', 'from_formats', 'to_formats', 'pipeline', 'page_range']
);
for (const path of [
  '/v1/chunk/hybrid/source/async',
  '/v1/chunk/hierarchical/source/async',
]) {
  assertRequestProperties(specification, path, 'post', 'application/json', [
    'convert_options',
    'chunking_options',
    'sources',
    'include_converted_doc',
    'target',
    'callbacks',
  ]);
}
for (const path of [
  '/v1/chunk/hybrid/file/async',
  '/v1/chunk/hierarchical/file/async',
]) {
  assertRequestProperties(specification, path, 'post', 'multipart/form-data', [
    'files',
    'convert_from_formats',
    'convert_pipeline',
    'chunking_use_markdown_tables',
    'chunking_use_markdown_images',
    'chunking_image_placeholder',
    'chunking_include_raw_text',
    'include_converted_doc',
    'target_type',
  ]);
}
assertRequestProperties(
  specification,
  '/v1/chunk/hybrid/file/async',
  'post',
  'multipart/form-data',
  ['chunking_max_tokens', 'chunking_tokenizer', 'chunking_merge_peers']
);
assertResponseContent(
  specification,
  '/v1/result/{task_id}',
  'get',
  '200',
  'application/zip'
);
assertResponseContent(
  specification,
  '/v1/result/{task_id}',
  'get',
  '200',
  'application/json'
);

const schemas = specification.components?.schemas;
assertObject(schemas, 'OpenAPI components.schemas');

const convertOptions = getSchema(schemas, ['ConvertDocumentsOptions']);
assertProperties(convertOptions, [
  'from_formats',
  'to_formats',
  'image_export_mode',
  'do_ocr',
  'force_ocr',
  'ocr_engine',
  'ocr_lang',
  'ocr_preset',
  'ocr_custom_config',
  'pdf_backend',
  'table_mode',
  'table_cell_matching',
  'pipeline',
  'page_range',
  'document_timeout',
  'abort_on_error',
  'do_table_structure',
  'include_images',
  'include_page_images',
  'images_scale',
  'md_page_break_placeholder',
  'do_code_enrichment',
  'do_formula_enrichment',
  'do_picture_classification',
  'do_chart_extraction',
  'do_picture_description',
  'picture_description_area_threshold',
  'picture_description_local',
  'picture_description_api',
  'vlm_pipeline_model',
  'vlm_pipeline_model_local',
  'vlm_pipeline_model_api',
  'vlm_pipeline_preset',
  'picture_description_preset',
  'code_formula_preset',
  'vlm_pipeline_custom_config',
  'picture_description_custom_config',
  'code_formula_custom_config',
  'table_structure_preset',
  'table_structure_custom_config',
  'layout_custom_config',
  'layout_preset',
  'picture_classification_preset',
  'picture_classification_custom_config',
]);

const convertRequest = getSchema(schemas, [
  'ConvertSourcesRequest',
  'ConvertDocumentsRequest',
]);
assertProperties(convertRequest, ['sources', 'target', 'options', 'callbacks']);
assertRequired(convertRequest, ['sources']);

const batchRequest = getSchema(schemas, ['BatchConvertSourcesRequest']);
assertProperties(batchRequest, ['sources', 'target', 'options', 'callbacks']);
assertRequired(batchRequest, ['sources', 'target']);

const taskStatus = getSchema(schemas, ['TaskStatusResponse']);
assertProperties(taskStatus, [
  'task_id',
  'task_type',
  'task_status',
  'task_position',
  'task_meta',
  'error_message',
  'failure',
]);
assertRequired(taskStatus, ['task_id', 'task_type', 'task_status']);

const convertResponse = getSchema(schemas, ['ConvertDocumentResponse']);
assertProperties(convertResponse, [
  'document',
  'status',
  'errors',
  'processing_time',
  'timings',
  'confidence',
]);
assertRequired(convertResponse, ['document', 'status', 'processing_time']);

const chunkResponse = getSchema(schemas, ['ChunkDocumentResponse']);
assertProperties(chunkResponse, ['chunks', 'documents', 'processing_time']);
assertRequired(chunkResponse, ['chunks', 'documents', 'processing_time']);

const countsResponse = getSchema(schemas, ['PresignedUrlConvertDocumentResponse']);
assertProperties(countsResponse, [
  'num_converted',
  'num_succeeded',
  'num_partially_succeeded',
  'num_failed',
  'processing_time',
]);
assertRequired(countsResponse, [
  'num_converted',
  'num_succeeded',
  'num_failed',
  'processing_time',
]);

const presignedResponse = getSchema(schemas, ['PresignedUrlConvertResponse']);
assertProperties(presignedResponse, ['documents']);
assertRequired(presignedResponse, ['documents']);

const artifactItem = getSchema(schemas, ['DocumentArtifactItem']);
assertProperties(artifactItem, [
  'source_index',
  'source_uri',
  'filename',
  'status',
  'errors',
  'timings',
  'artifacts',
  'confidence',
]);
assertRequired(artifactItem, ['source_index', 'source_uri', 'filename', 'status']);

const artifactRef = getSchema(schemas, ['ArtifactRef']);
assertProperties(artifactRef, ['artifact_type', 'mime_type', 'uri', 'url_expires_at']);
assertRequired(artifactRef, ['artifact_type', 'mime_type', 'uri']);

for (const [targetName, kind] of [
  ['InBodyTarget', 'inbody'],
  ['ZipTarget', 'zip'],
  ['PutTarget', 'put'],
  ['PresignedUrlTarget', 'presigned_url'],
  ['S3Target', 's3'],
  ['AzureBlobTarget', 'azure_blob'],
  ['GoogleCloudStorageTarget', 'google_cloud_storage'],
  ['GoogleDriveTarget', 'google_drive'],
]) {
  const target = getSchema(schemas, [targetName]);
  assertProperties(target, ['kind']);
  assertPropertyLiteral(target, 'kind', kind);
}

const fileSource = getSchema(schemas, ['FileSourceRequest']);
assertProperties(fileSource, ['kind', 'base64_string', 'filename']);
assertRequired(fileSource, ['base64_string', 'filename']);
assertPropertyLiteral(fileSource, 'kind', 'file');

const httpSource = getSchema(schemas, ['AnyHttpSourceRequest', 'HttpSourceRequest']);
assertProperties(httpSource, ['kind', 'url', 'headers']);
assertRequired(httpSource, ['url']);
assertPropertyLiteral(httpSource, 'kind', 'http');

assertConnector(
  schemas,
  ['S3SourceRequest'],
  's3',
  ['endpoint', 'verify_ssl', 'access_key', 'secret_key', 'bucket', 'key_prefix'],
  ['endpoint', 'access_key', 'secret_key', 'bucket']
);
assertConnector(
  schemas,
  ['S3Target'],
  's3',
  ['endpoint', 'verify_ssl', 'access_key', 'secret_key', 'bucket', 'key_prefix'],
  ['endpoint', 'access_key', 'secret_key', 'bucket']
);
assertConnector(
  schemas,
  ['AzureBlobSourceRequest'],
  'azure_blob',
  ['account_name', 'container', 'connection_string', 'blob_prefix'],
  ['account_name', 'container', 'connection_string']
);
assertConnector(
  schemas,
  ['AzureBlobTarget'],
  'azure_blob',
  ['account_name', 'container', 'connection_string', 'blob_prefix'],
  ['account_name', 'container', 'connection_string']
);
assertConnector(
  schemas,
  ['GoogleCloudStorageSourceRequest'],
  'google_cloud_storage',
  ['bucket', 'key_prefix', 'project', 'service_account_key'],
  ['bucket']
);
assertConnector(
  schemas,
  ['GoogleCloudStorageTarget'],
  'google_cloud_storage',
  ['bucket', 'key_prefix', 'project', 'service_account_key'],
  ['bucket']
);
assertConnector(
  schemas,
  ['GoogleDriveSourceRequest'],
  'google_drive',
  ['path_id', 'token_path', 'refresh_token', 'credentials_path', 'credentials'],
  ['path_id']
);
assertConnector(
  schemas,
  ['GoogleDriveTarget'],
  'google_drive',
  ['path_id', 'token_path', 'refresh_token', 'credentials_path', 'credentials'],
  ['path_id']
);

const putTarget = getSchema(schemas, ['PutTarget']);
assertProperties(putTarget, ['kind', 'url']);
assertRequired(putTarget, ['url']);

const callback = getSchema(schemas, ['CallbackSpec']);
assertProperties(callback, ['url', 'headers', 'ca_cert']);
assertRequired(callback, ['url']);

for (const [schemaNames, chunker] of [
  [['HybridChunkerOptionsDocumentsRequest', 'HybridChunkDocumentsRequest'], 'hybrid'],
  [
    ['HierarchicalChunkerOptionsDocumentsRequest', 'HierarchicalChunkDocumentsRequest'],
    'hierarchical',
  ],
]) {
  const request = getSchema(schemas, schemaNames);
  assertProperties(request, [
    'convert_options',
    'sources',
    'include_converted_doc',
    'target',
    'callbacks',
    'chunking_options',
  ]);
  assertChunkerLiteral(specification, request, chunker);
}

assertEnumContains(
  schemas,
  ['InputFormat'],
  [
    'docx',
    'doc',
    'pptx',
    'html',
    'image',
    'pdf',
    'asciidoc',
    'md',
    'csv',
    'xlsx',
    'xml_uspto',
    'xml_jats',
    'json_docling',
    'dclx',
    'audio',
    'vtt',
    'xml_xbrl',
    'mets_gbs',
    'latex',
    'ppt',
    'xls',
    'odt',
    'ods',
    'odp',
    'xml_doclang',
    'video',
    'email',
    'epub',
    'boxnote',
  ]
);
assertEnumContains(
  schemas,
  ['OutputFormat'],
  [
    'md',
    'json',
    'yaml',
    'html',
    'html_split_page',
    'text',
    'doctags',
    'vtt',
    'doclang',
    'dclx',
    'chunks',
  ]
);
assertEnumContains(
  schemas,
  ['ConversionStatus'],
  ['pending', 'started', 'success', 'failure', 'partial_success', 'skipped']
);

process.stdout.write(
  `Docling client contract checks passed for ${openApiUrl} (${specification.info?.version ?? 'unknown version'}).\n`
);

function assertPath(spec, path, method) {
  if (spec.paths?.[path]?.[method] === undefined) {
    throw new Error(`OpenAPI is missing ${method.toUpperCase()} ${path}`);
  }
}

function operation(spec, path, method) {
  const value = spec.paths?.[path]?.[method];
  assertObject(value, `${method.toUpperCase()} ${path}`);
  return value;
}

function assertJsonRequest(spec, path, method) {
  const requestBody = operation(spec, path, method).requestBody;
  assertObject(requestBody, `${method.toUpperCase()} ${path} request body`);
  if (requestBody.content?.['application/json'] === undefined) {
    throw new Error(
      `OpenAPI is missing application/json for ${method.toUpperCase()} ${path} request`
    );
  }
}

function assertMultipartRequest(spec, path, method) {
  const requestBody = operation(spec, path, method).requestBody;
  assertObject(requestBody, `${method.toUpperCase()} ${path} request body`);
  if (requestBody.content?.['multipart/form-data'] === undefined) {
    throw new Error(
      `OpenAPI is missing multipart/form-data for ${method.toUpperCase()} ${path} request`
    );
  }
}

function assertRequestProperties(spec, path, method, contentType, names) {
  const requestSchema = operation(spec, path, method).requestBody?.content?.[
    contentType
  ]?.schema;
  assertObject(
    requestSchema,
    `${method.toUpperCase()} ${path} ${contentType} request schema`
  );
  const resolved = flattenSchema(spec, requestSchema);
  assertProperties(resolved, names);
}

function assertPathParameter(spec, path, method, parameterName) {
  const parameters = operation(spec, path, method).parameters ?? [];
  if (
    !parameters.some(
      parameter =>
        parameter?.name === parameterName &&
        parameter?.in === 'path' &&
        parameter?.required === true
    )
  ) {
    throw new Error(
      `OpenAPI is missing required path parameter ${parameterName} for ${method.toUpperCase()} ${path}`
    );
  }
}

function getSchema(schemas, acceptedNames) {
  const name = acceptedNames.find(candidate => schemas[candidate] !== undefined);
  if (name === undefined) {
    throw new Error(
      `OpenAPI is missing a compatible schema: ${acceptedNames.join(' or ')}`
    );
  }
  const schema = schemas[name];
  assertObject(schema, `OpenAPI schema ${name}`);
  return schema;
}

function assertConnector(schemas, schemaNames, kind, properties, required) {
  const schema = getSchema(schemas, schemaNames);
  assertProperties(schema, ['kind', ...properties]);
  assertRequired(schema, required);
  assertPropertyLiteral(schema, 'kind', kind);
}

function assertPropertyLiteral(schema, propertyName, expected) {
  const property = schema.properties?.[propertyName];
  assertObject(property, `OpenAPI property ${propertyName}`);
  const values =
    property.enum ?? (property.const === undefined ? [] : [property.const]);
  if (!values.includes(expected) && property.default !== expected) {
    throw new Error(
      `OpenAPI property ${propertyName} does not declare literal ${expected}`
    );
  }
}

function assertChunkerLiteral(spec, requestSchema, expected) {
  const chunkingProperty = requestSchema.properties?.chunking_options;
  assertObject(chunkingProperty, 'OpenAPI chunking_options property');
  const chunkingSchema = dereference(spec, chunkingProperty);
  assertPropertyLiteral(chunkingSchema, 'chunker', expected);
}

function dereference(spec, schema) {
  if (typeof schema.$ref !== 'string') {
    return schema;
  }
  const prefix = '#/components/schemas/';
  if (!schema.$ref.startsWith(prefix)) {
    throw new Error(`Unsupported OpenAPI schema reference ${schema.$ref}`);
  }
  const resolved = spec.components?.schemas?.[schema.$ref.slice(prefix.length)];
  assertObject(resolved, `OpenAPI schema ${schema.$ref}`);
  return resolved;
}

function flattenSchema(spec, schema) {
  const resolved = dereference(spec, schema);
  const composed = [...(resolved.allOf ?? []), ...(resolved.anyOf ?? [])];
  if (composed.length === 0) {
    return resolved;
  }
  const properties = { ...(resolved.properties ?? {}) };
  const required = new Set(resolved.required ?? []);
  for (const member of composed) {
    const flattened = flattenSchema(spec, member);
    Object.assign(properties, flattened.properties ?? {});
    for (const name of flattened.required ?? []) {
      required.add(name);
    }
  }
  return { ...resolved, properties, required: [...required] };
}

function assertProperties(schema, names) {
  assertObject(schema.properties, 'OpenAPI schema properties');
  for (const name of names) {
    if (schema.properties[name] === undefined) {
      throw new Error(`OpenAPI schema is missing property ${name}`);
    }
  }
}

function assertRequired(schema, names) {
  const required = new Set(schema.required ?? []);
  for (const name of names) {
    if (!required.has(name)) {
      throw new Error(`OpenAPI schema does not require ${name}`);
    }
  }
}

function assertEnumContains(schemas, acceptedNames, values) {
  const schema = getSchema(schemas, acceptedNames);
  const actual = new Set(schema.enum ?? []);
  for (const value of values) {
    if (!actual.has(value)) {
      throw new Error(`OpenAPI enum ${acceptedNames.join('/')} is missing ${value}`);
    }
  }
}

function assertResponseContent(spec, path, method, status, contentType) {
  if (
    spec.paths?.[path]?.[method]?.responses?.[status]?.content?.[contentType] ===
    undefined
  ) {
    throw new Error(
      `OpenAPI is missing ${contentType} for ${method.toUpperCase()} ${path} response ${status}`
    );
  }
}

function assertObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}
