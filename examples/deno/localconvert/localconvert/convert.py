import json
import logging
import os
import pillow_jxl
import sys
import time
import traceback

from pathlib import Path
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.pipeline_options import smolvlm_picture_description

logging.basicConfig(level=logging.INFO, datefmt='%Y-%m-%d,%H:%M:%S', format='%(asctime)s %(levelname)-8s %(message)s')

input_path = sys.argv[1]
output_path = sys.argv[2]

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

while True:
    conversions = 0
    for (path, dirs, files) in os.walk(input_path, topdown=True):
        for file in files:
            if file.endswith(".pdf"):
                in_path = Path(f"{path}/{file}")
                out_path = Path(f"{output_path}/{path.replace(input_path, '')}/{file}")
                doc_path = Path(f"{out_path}/{file}.json")

                logging.info(f"Converting {in_path} ...")

                try:
                    # Convert document.
                    conversion = converter.convert(in_path)
                    doc = conversion.document

                    # Remove picture images.
                    for picture in doc.pictures:
                        picture.image = None

                    # Save page images instead.
                    filename = conversion.input.file.stem
                    out_path.mkdir(parents=True, exist_ok=True)

                    for page_no, page in doc.pages.items():
                        page_no = page.page_no
                        page_image_filename = Path(f"{out_path}/{page_no}.jpg")
                        with page_image_filename.open("wb") as fp:
                            page.image.pil_image.save(fp, quality=98)
                            page.image.uri = page_image_filename

                    doc_dict = doc.export_to_dict()
                    doc_dict["origin"]["uri"] = str(doc_path)

                    with doc_path.open("w") as fp:
                        json.dump(doc_dict, fp)

                    os.remove(in_path)

                    logging.info(f"Converted and saved to {out_path}")
                except Exception:
                    logging.error(traceback.format_exc())
                    logging.error(f"Failed to convert {in_path}.")

    if conversions == 0:
        logging.info("Nothing to convert after poll.")
        time.sleep(10)
    else:
        conversions = 0
