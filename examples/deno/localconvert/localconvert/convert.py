import sys
import logging
import json
from io import BytesIO
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, DocumentStream, PdfFormatOption
from docling.datamodel.pipeline_options import smolvlm_picture_description

logging.basicConfig(level=logging.INFO)

pipeline_options = PdfPipelineOptions()
# pipeline_options.do_picture_description = True
# pipeline_options.picture_description_options = (
#     smolvlm_picture_description
# )
# pipeline_options.picture_description_options.prompt = (
#     "Describe the image in three sentences. Be consise and accurate."
# )
pipeline_options.images_scale = 2.0
pipeline_options.generate_picture_images = True
pipeline_options.generate_page_images = True

logging.info("Pre converter construct")
converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_options=pipeline_options,
        )
    }
)

source = DocumentStream(
    name=sys.argv[1],
    stream=BytesIO(sys.stdin.buffer.read())
)
doc = converter.convert(source).document

sys.stdout.write(json.dumps(doc.export_to_dict()))
