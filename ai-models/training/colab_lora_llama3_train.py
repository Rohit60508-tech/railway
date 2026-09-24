"""
colab_lora_llama3_train.py
─────────────────────────────────────────────────────────────────────────────
Step 4 & 5: Google Colab T4 / Free GPU Fine-Tuning Script using Unsloth & TRL
Model: Llama 3 8B Instruct (4-bit quantized)
Dataset: railway_dispatch_sft.jsonl
Method: QLoRA (Rank 16, Alpha 16)
Export: Merged LoRA adapters for Ollama / Hugging Face Serverless Inference
─────────────────────────────────────────────────────────────────────────────
"""

# Install required Colab packages:
# !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install --no-deps "xformers<0.0.27" trl peft accelerate bitsandbytes

def main():
    import torch
    from unsloth import FastLanguageModel
    from datasets import load_dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments

    max_seq_length = 2048
    dtype = None # Auto detection
    load_in_4bit = True

    print("[1/5] Loading 4-bit Llama-3-8B-Instruct via Unsloth...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="unsloth/llama-3-8b-Instruct-bnb-4bit",
        max_seq_length=max_seq_length,
        dtype=dtype,
        load_in_4bit=load_in_4bit,
    )

    print("[2/5] Configuring LoRA Adapter Target Matrices...")
    model = FastLanguageModel.get_peft_model(
        model,
        r=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    print("[3/5] Loading and formatting JSONL railway dispatch dataset...")
    # Upload data/railway_dispatch_sft.jsonl to your Colab session
    dataset = load_dataset("json", data_files="railway_dispatch_sft.jsonl", split="train")

    def format_prompts(batch):
        texts = []
        for messages in batch["messages"]:
            # Apply standard Llama-3 chat template
            formatted = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
            texts.append(formatted)
        return {"text": texts}

    formatted_dataset = dataset.map(format_prompts, batched=True)

    print("[4/5] Starting Supervised Fine-Tuning (SFT)...")
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=formatted_dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        dataset_num_proc=2,
        packing=False,
        args=TrainingArguments(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=10,
            max_steps=100,
            learning_rate=2e-4,
            fp16=not torch.cuda.is_bf16_supported(),
            bf16=torch.cuda.is_bf16_supported(),
            logging_steps=10,
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=42,
            output_dir="outputs",
        ),
    )

    trainer.train()

    print("[5/5] Exporting Trained Model...")
    # Option A: Save 16-bit LoRA adapter for Hugging Face Hub
    model.save_pretrained_merged("lora_railway_dispatch_adapter", tokenizer, save_method="lora")
    print("  [OK] LoRA weights saved to 'lora_railway_dispatch_adapter'")

    # Option B: Export GGUF format for local Ollama deployment:
    # model.save_pretrained_gguf("railway_dispatch_model_q4", tokenizer, quantization_method="q4_k_m")
    # print("  [OK] Exported GGUF for Ollama (run: ollama create railway-ai -f Modelfile)")

if __name__ == "__main__":
    main()
