const modelId = "ds4sd/SmolDocling-256M-preview";

let model;
let processor;

async function infer({ data }) {
  postMessage({ progress: "Loading dependencies..." });

  const { AutoProcessor, AutoModelForVision2Seq, TextStreamer, load_image } =
    await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers");
  const doc = await import("./doctags.js");

  try {
    postMessage({ progress: "Loading images..." });
    const { imageFiles } = data;
    const images = await Promise.all(imageFiles.map(load_image));

    postMessage({ progress: "Loading models..." });

    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      throw new Error("No GPU support.");
    }

    model ??= await AutoModelForVision2Seq.from_pretrained(modelId, {
      device: "webgpu",
    });
    processor ??= await AutoProcessor.from_pretrained(modelId);

    const inputs = await processor(
      `<|im_start|>User:<image>Convert this page to docling.<end_of_utterance>`,
      images
    );

    let tags = "";

    const streamer = new TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: false,
      callback_function(output) {
        tags += output
          .replaceAll("Assistant:", "")
          .replaceAll("<end_of_utterance>", "");

        postMessage({ progress: "Generating tags...", result: { tags } });
      },
    });

    await model
      .generate({
        ...inputs,
        do_sample: false,
        max_new_tokens: Number.MAX_VALUE,
        streamer,
        return_dict_in_generate: false,
      })
      .catch((e) => {
        throw e;
      });

    postMessage({ progress: "Converting tags...", result: { tags } });

    const conversion = await doc.fromTags(tags, imageFiles[0]);

    postMessage({
      progress: "Conversion complete.",
      result: {
        tags,
        html: doc.toHtml(conversion),
        json: doc.toJson(conversion),
        md: doc.toMarkdown(conversion),
      },
    });
  } catch (e) {
    console.error(e);
    postMessage({ error: `Oops! We have a problem: ${e}` });
  }
}

addEventListener("message", infer);
