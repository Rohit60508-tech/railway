"""
colab_qwen_vl_train.py
─────────────────────────────────────────────────────────────────────────────
Step 2 & 3: Fine-Tune Qwen2.5-VL-7B / 3B on Railway Multimodal Data (Colab T4 / A100)
Framework: Unsloth FastVisionModel + Hugging Face SFTTrainer
Quantization: 4-bit NF4 with LoRA adapters (Rank 16, Alpha 16)
Vision Encoder: Frozen (Saves VRAM to run on 15GB T4 GPU)
─────────────────────────────────────────────────────────────────────────────
"""

# Install commands for Google Colab:
# !pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
# !pip install --no-deps "xformers<0.0.27" trl peft accelerate bitsandbytes torchvision

def train_vlm():
    import torch
    from unsloth import FastVisionModel
    from datasets import load_dataset
    from trl import SFTTrainer, SFTConfig

    print("[1/4] Loading Pre-trained Qwen2.5-VL-7B-Instruct (4-bit)...")
    model, tokenizer = FastVisionModel.from_pretrained(
        "unsloth/Qwen2.5-VL-7B-Instruct-bnb-4bit",
        load_in_4bit=True,
        use_gradient_checkpointing="unsloth"
    )

    print("[2/4] Attaching LoRA Adapters (Vision frozen, Language & Cross-Attention active)...")
    model = FastVisionModel.get_peft_model(
        model,
        finetune_vision_layers=False,   # Keep vision encoder frozen to save VRAM
        finetune_language_layers=True,   # Fine-tune reasoning & JSON formatting
        finetune_attention_modules=True,
        finetune_mlp_modules=True,
        r=16,
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        random_state=42
    )

    print("[3/4] Loading Railway LLaVA dataset...")
    # Upload data/railway_vlm_dataset.json to Colab session
    dataset = load_dataset("json", data_files="railway_vlm_dataset.json", split="train")

    print("[4/4] Starting VLM Supervised Fine-Tuning...")
    training_args = SFTConfig(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        warmup_steps=5,
        max_steps=60,
        learning_rate=2e-4,
        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=10,
        output_dir="railway_vlm_output",
        seed=42
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="conversations",
        max_seq_length=2048,
        args=training_args
    )

    trainer.train()

    # Save fine-tuned adapter weights
    model.save_pretrained_merged("qwen2.5_vl_railway_lora", tokenizer, save_method="lora")
    print("  [OK] Fine-tuned VLM LoRA weights saved to 'qwen2.5_vl_railway_lora'")

if __name__ == "__main__":
    train_vlm()
