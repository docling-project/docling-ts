import {
  type AutoSubmitResult,
  type ConfidenceScores,
  type DoclingComponentType,
  DoclingClient,
  type DoclingJob,
  type ConversionItem,
  type ConversionResult,
  type ConvertDocumentsOptions,
  type FailureCategory,
  type InBodyTarget,
  type PictureClassificationLabel,
  type PresignedUrlConvertResponse,
  type ProfilingScope,
  type QualityGrade,
} from '../src';

export function compileTimeParity(client: DoclingClient): unknown[] {
  const auto = client.submitUrl('https://example.test/manual.pdf');
  const autoCheck: Promise<DoclingJob<AutoSubmitResult>> = auto;

  const inBody = client.submitUrl(
    'https://example.test/manual.pdf',
    {},
    { target: { kind: 'inbody' } satisfies InBodyTarget }
  );
  const inBodyCheck: Promise<DoclingJob<ConversionResult>> = inBody;

  const presigned = client.submitFile(
    'ZmlsZQ==',
    'manual.pdf',
    {},
    {
      target: { kind: 'presigned_url' },
    }
  );
  const presignedCheck: Promise<DoclingJob<PresignedUrlConvertResponse>> = presigned;

  const autoFanout: AsyncGenerator<
    [ConversionItem & { metadata?: unknown }, AutoSubmitResult | Error]
  > = client.submitAndRetrieveEach([{ source: 'https://example.test/a.pdf' }]);

  const confidence = {
    parse_score: 0.91,
    layout_score: null,
    mean_grade: 'good',
    low_grade: 'fair',
  } satisfies ConfidenceScores;
  const category: FailureCategory = 'backend_failure';
  const component: DoclingComponentType = 'document_backend';
  const scope: ProfilingScope = 'document';
  const grade: QualityGrade = 'excellent';
  const pictureLabel: PictureClassificationLabel = 'engineering_drawing';
  const pictureOptions: ConvertDocumentsOptions = {
    picture_description_local: {
      repo_id: 'model',
      classification_allow: [pictureLabel],
    },
  };

  // @ts-expect-error Python's wire contract does not accept arbitrary categories.
  const invalidCategory: FailureCategory = 'made_up';
  // @ts-expect-error Python's wire contract does not accept arbitrary grades.
  const invalidGrade: QualityGrade = 'great';
  // @ts-expect-error Python's wire contract does not accept arbitrary scopes.
  const invalidScope: ProfilingScope = 'task';
  // @ts-expect-error Picture labels are the exact Docling Core enum.
  const invalidPictureLabel: PictureClassificationLabel = 'diagram';

  return [
    autoCheck,
    inBodyCheck,
    presignedCheck,
    autoFanout,
    confidence,
    category,
    component,
    scope,
    grade,
    invalidCategory,
    invalidGrade,
    invalidScope,
    pictureOptions,
    invalidPictureLabel,
  ];
}
