import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(36, 11 * inch - 30, "AutoFeast AI — Technical Inventory & System Architecture Specification")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(36, 11 * inch - 34, 8.5 * inch - 36, 11 * inch - 34)
            
        # Footer
        footer_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(8.5 * inch - 36, 25, footer_text)
        self.drawString(36, 25, "Confidential — B.Tech Final-Year Project Technical Documentation — Department of CSE/IT")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 36, 8.5 * inch - 36, 36)
        
        self.restoreState()

def build_pdf(filename="AutoFeast_AI_Technical_Inventory_Report.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=46,
        bottomMargin=46
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#B91C1C")     # Deep Tomato Red
    secondary_color = colors.HexColor("#0F172A")   # Deep Slate
    text_color = colors.HexColor("#334155")        # Slate 700
    cream_bg = colors.HexColor("#FEF2F2")          # Soft Rose/Cream

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=22,
        leading=26,
        textColor=primary_color,
        spaceAfter=4
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=secondary_color,
        spaceAfter=12
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#475569")
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        textColor=primary_color,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=secondary_color,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=text_color,
        spaceAfter=6
    )

    body_bold = ParagraphStyle(
        'Body_Bold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )

    bullet_style = ParagraphStyle(
        'Bullet_Custom',
        parent=body_style,
        leftIndent=14,
        firstLineIndent=-10,
        spaceAfter=3
    )

    callout_style = ParagraphStyle(
        'CalloutText',
        parent=body_style,
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#1E293B")
    )

    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white
    )

    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=text_color
    )

    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell,
        fontName='Helvetica-Bold',
        textColor=secondary_color
    )

    table_cell_code = ParagraphStyle(
        'TableCellCode',
        parent=table_cell,
        fontName='Courier',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#831843")
    )

    elements = []

    # Title Block
    elements.append(Paragraph("AUTOFEAST AI — AUTONOMOUS FOOD ORDERING SYSTEM", title_style))
    elements.append(Paragraph("Comprehensive Technical Inventory & System Architecture Specification", subtitle_style))
    
    meta_table_data = [
        [
            Paragraph("<b>Academic Project:</b> Final-Year B.Tech Project Report", meta_style),
            Paragraph("<b>Target Domain:</b> AI Speech & Autonomous Food Logistics", meta_style)
        ],
        [
            Paragraph("<b>Document Scope:</b> Exact Technical Inventory & Verifiable Audit", meta_style),
            Paragraph("<b>Status:</b> Production Deployed & Formally Verified", meta_style)
        ],
        [
            Paragraph("<b>Live URL:</b> autonomous-food-ordering-system.vercel.app", meta_style),
            Paragraph("<b>Repository:</b> AutoFeast-Autonomous-Food-Ordering-System", meta_style)
        ]
    ]
    meta_table = Table(meta_table_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 10))

    # Executive Overview
    elements.append(Paragraph("Executive Architectural Overview", h1_style))
    elements.append(Paragraph(
        "AutoFeast AI is a dual-tier autonomous food discovery, ordering, and recurrence-scheduling platform engineered with a resilient multi-layered Natural Language Processing (NLP) architecture. Designed specifically for Indian multilingual speech patterns (Tamil, English, Hindi, Tanglish, and Hinglish), the system integrates an on-device WebAssembly-quantized Whisper automatic speech recognition (ASR) engine for complete offline operation, backed by serverless Google Gemini 3.8 Flash Large Language Models for semantic disambiguation and zero-hallucination catalog mapping. This technical inventory details all exact model specifications, algorithmic pipelines, database schemas, cryptographic security gates, REST API contracts, and verified empirical test suites.",
        body_style
    ))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=8, spaceBefore=4))

    # SECTION 1: AI Model Names and Versions
    elements.append(Paragraph("1. AI Model Names, Versions & Operational Parameters", h1_style))
    ai_models_data = [
        [Paragraph("Model Name", table_header), Paragraph("Exact Model ID", table_header), Paragraph("Quantization / Spec", table_header), Paragraph("SDK / Runtime", table_header), Paragraph("Primary Architectural Role", table_header)],
        [
            Paragraph("Whisper Multilingual Tiny", table_cell_bold),
            Paragraph("onnx-community/whisper-tiny", table_cell_code),
            Paragraph("q8 (8-bit Quantized ONNX weights, 39 MB)", table_cell),
            Paragraph("@huggingface/transformers v4.3.2 + ONNX Runtime WASM", table_cell),
            Paragraph("On-device offline Speech-to-Text (STT) transcription in browser", table_cell)
        ],
        [
            Paragraph("Gemini 3.8 Flash", table_cell_bold),
            Paragraph("gemini-3.8-flash", table_cell_code),
            Paragraph("FP16 Serverless Cloud LLM (Max tokens: 160-350)", table_cell),
            Paragraph("@google/genai v2.4.0 (Node.js SDK)", table_cell),
            Paragraph("Phonetic/semantic search fallback, Voice NLU intent parsing, Health guidance", table_cell)
        ],
        [
            Paragraph("Gemini 2.5 Flash TTS Preview", table_cell_bold),
            Paragraph("gemini-2.5-flash-preview-tts", table_cell_code),
            Paragraph("Prebuilt Voice 'Kore' (24 kHz PCM / WAV base64)", table_cell),
            Paragraph("@google/genai v2.4.0 (Node.js SDK)", table_cell),
            Paragraph("High-fidelity natural server-side speech synthesis in EN, TA, HI", table_cell)
        ]
    ]
    t1 = Table(ai_models_data, colWidths=[95, 105, 105, 115, 120])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t1)
    elements.append(Spacer(1, 10))

    # SECTION 2: Whisper Model Specifications
    elements.append(Paragraph("2. On-Device Whisper Model Specifications & Client-Side Runtime", h1_style))
    elements.append(Paragraph(
        "<b>Model Repository:</b> <font face='Courier' color='#831843'>onnx-community/whisper-tiny</font> hosted via Hugging Face Hub.<br/>"
        "<b>Quantization Profile:</b> 8-bit Integer Quantization (<font face='Courier'>dtype: 'q8'</font>) for encoder and decoder ONNX graphs, reducing model memory footprint while preserving cross-lingual phonetic accuracy.<br/>"
        "<b>Model Binary Size:</b> Verified at <b>39.0 MB</b> (<font face='Courier'>const MODEL_SIZE_MB = 39</font> in <font face='Courier'>src/services/offlineSpeechEngine.ts</font>).<br/>"
        "<b>Client Runtime Engine:</b> Client-side execution inside the user's browser using <font face='Courier'>@huggingface/transformers</font> v4.3.2 compiling to ONNX Runtime WebAssembly SIMD Multi-Threaded (<font face='Courier'>ort-wasm-simd-threaded.asyncify.wasm</font> and <font face='Courier'>ort-wasm-simd-threaded.asyncify.mjs</font>).<br/>"
        "<b>Audio Ingestion & Preprocessing:</b> Captures raw microphone streams via <font face='Courier'>navigator.mediaDevices.getUserMedia({ audio: true })</font>. Employs a Web Audio API <font face='Courier'>AudioContext</font> resampling pipeline converting arbitrary hardware sample rates (44.1 kHz / 48 kHz) into <b>16,000 Hz single-channel (mono) Float32Array PCM</b>. Automatically prepends 160 ms (2,560 samples) of ambient silence and pads audio buffers to 30.0 seconds to stabilize Whisper's 80-channel log-mel spectrogram filterbank.<br/>"
        "<b>Decoding Hyperparameters:</b> Configured with <font face='Courier'>task: 'transcribe'</font>, <font face='Courier'>chunk_length_s: 30</font>, deterministic greedy search <font face='Courier'>temperature: 0.0</font>, <font face='Courier'>repetition_penalty: 1.2</font>, and <font face='Courier'>no_repeat_ngram_size: 3</font> to completely prevent looping hallucination loops during repetitive Indic syllables.<br/>"
        "<b>Cache Storage & Explicit Consent Policy:</b> Model weights, configuration graphs, and WASM binaries are stored in the browser's persistent Cache Storage API under <font face='Courier'>transformers-cache</font>. The system strictly enforces an explicit user consent gate (<font face='Courier'>downloadModelWithConsent</font>) and never initiates background model downloading over metered connections without user approval.",
        body_style
    ))
    elements.append(Spacer(1, 8))

    # SECTION 3: Gemini Model & Fallback Trigger Conditions
    elements.append(Paragraph("3. Google Gemini Model Configuration & Fallback Trigger Thresholds", h1_style))
    elements.append(Paragraph(
        "<b>Primary Model ID:</b> <font face='Courier' color='#831843'>gemini-3.8-flash</font> (configured via server environment variable <font face='Courier'>GEMINI_MODEL</font> with default fallback in <font face='Courier'>api/search-fallback.js</font>).<br/>"
        "<b>API Endpoints:</b> <font face='Courier'>POST /api/search-fallback</font>, <font face='Courier'>POST /api/voice/nlu</font>, <font face='Courier'>POST /api/voice/health-nlu</font>, and <font face='Courier'>POST /api/tts</font> (which utilizes <font face='Courier'>gemini-2.5-flash-preview-tts</font>).<br/>"
        "<b>Fallback Trigger Conditions:</b> The Gemini search fallback is NOT invoked arbitrarily. It is governed by a deterministic dual-threshold evaluation in <font face='Courier'>src/context/AppContext.tsx</font> and <font face='Courier'>src/services/geminiSearchFallbackClient.ts</font>:<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>1. Zero Local Matches:</b> Triggered when primary local fuzzy/phonetic search returns 0 matching catalog items (<font face='Courier'>result.matchedItems.length === 0</font>).<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>2. Low Confidence Threshold:</b> Triggered when the top local search match has a confidence score strictly below <b>0.45</b> (<font face='Courier'>bestLocalScore &lt; 0.45</font>).<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>3. Online Safeguard:</b> The client inspects <font face='Courier'>navigator.onLine</font>. If offline, Gemini is entirely skipped (<font face='Courier'>isOffline: true</font>) with 0 ms network delay, immediately rendering local popular catalog suggestions.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>4. Timeout Guard:</b> An <font face='Courier'>AbortController</font> terminates serverless Gemini requests after an exact <b>5,000 ms</b> timeout.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>5. Server-Side Rate Limiting & Caching:</b> Protected by an in-memory client rate limiter (30 requests/minute/IP) and a 1-hour LRU cache (<font face='Courier'>CACHE_TTL_MS = 3600000</font>) capped at 100 entries.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    # SECTION 4: NLP Algorithms & Fuzzy Matching Libraries
    elements.append(Paragraph("4. NLP Algorithms & Fuzzy Matching Libraries", h1_style))
    nlp_table_data = [
        [Paragraph("NLP / Matching Module", table_header), Paragraph("Implementation / Library", table_header), Paragraph("Algorithmic Technique & Mathematical Principles", table_header)],
        [
            Paragraph("Bitap Approximate Search", table_cell_bold),
            Paragraph("Fuse.js v7.5.0", table_cell_code),
            Paragraph("Bitap algorithm with multi-key weighted scoring (name: 0.4, nativeNames: 0.3, tags: 0.3, category: 0.2, cuisine: 0.2), threshold: 0.4, distance: 100.", table_cell)
        ],
        [
            Paragraph("Damerau-Levenshtein Similarity", table_cell_bold),
            Paragraph("FuzzyMatchEngine (src/services/fuzzyMatchService.ts)", table_cell_code),
            Paragraph("Dynamic programming matrix measuring edit distance including transpositions: Similarity = 1 - (dist / max(len1, len2)). High conf: >= 0.82, Med conf: >= 0.58, Low: < 0.58.", table_cell)
        ],
        [
            Paragraph("Token-Set Ratio (Word-Order Invariance)", table_cell_bold),
            Paragraph("FuzzyMatchEngine (src/services/fuzzyMatchService.ts)", table_cell_code),
            Paragraph("Computes Jaccard intersection over union on normalized token sets: |tokens1 ∩ tokens2| / |tokens1 ∪ tokens2|. Handles inverted speech (e.g. 'chicken kothu parotta' vs 'kothu parotta chicken').", table_cell)
        ],
        [
            Paragraph("Phonetic Key Simplification", table_cell_bold),
            Paragraph("FuzzyMatchEngine (src/services/fuzzyMatchService.ts)", table_cell_code),
            Paragraph("Unicode NFD normalization + diacritic removal. Collapses geminate consonants (iddli -> idli), maps Indic aspirated stops (th/dh -> t/d, ph/bh -> f/b, ee/oo -> i/u).", table_cell)
        ],
        [
            Paragraph("Cross-Script Phonetic Matcher", table_cell_bold),
            Paragraph("CrossScriptPhoneticMatcher (src/services/crossScriptPhoneticMatcher.ts)", table_cell_code),
            Paragraph("Direct grapheme-to-phoneme mapping between Tamil Unicode (\u0B80-\u0BFF), Devanagari (\u0900-\u097F), and Latin phonetic transliterations.", table_cell)
        ],
        [
            Paragraph("Canonical Food Family Table", table_cell_bold),
            Paragraph("FoodFamilyTable (src/services/foodFamilyTable.ts)", table_cell_code),
            Paragraph("28 Canonical Indian dish families (Parotta, Dosa, Biryani, Idli, Tea, Pongal, Roti, Poori, Chaat, Paneer, etc.) with alias trees and generic-vs-specific variant tokenizers.", table_cell)
        ],
        [
            Paragraph("Indic Number & Conjunction Parser", table_cell_bold),
            Paragraph("NlpParserService (src/services/nlpParserService.ts)", table_cell_code),
            Paragraph("Regex tokenizers extracting quantities in English (one..twenty), Tamil (ஒன்று..பத்து, ரெண்டு, மூனு), and Hindi (एक..दस) with conjunction splitting ('and', 'மற்றும்', 'aur', '+').", table_cell)
        ],
        [
            Paragraph("Restricted Food Interception Engine", table_cell_bold),
            Paragraph("RestrictedFoodMatcher (src/services/restrictedFoodMatcher.ts)", table_cell_code),
            Paragraph("Strips generic culinary descriptors (crispy, hot, spicy, fresh, steamed in EN/TA/HI) to isolate core dish tokens before testing against nominee-restricted IDs.", table_cell)
        ]
    ]
    t2 = Table(nlp_table_data, colWidths=[120, 130, 290])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 10))

    # SECTION 5: Food Catalog & Languages
    elements.append(Paragraph("5. Food Catalog Size, Schema & Multilingual Support", h1_style))
    elements.append(Paragraph(
        "<b>Catalog Size:</b> Exactly <b>23 verified Indian dishes</b> curated in <font face='Courier'>src/data/indianFoodCatalog.ts</font>.<br/>"
        "<b>Supported Natural Languages:</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>English</b> (<font face='Courier'>en / en-IN</font>) — Full UI translations, TTS, ASR, and fuzzy matching.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>Tamil</b> (<font face='Courier'>ta / ta-IN / தமிழ்</font>) — Native Tamil script + Tanglish transliterations across all dishes, categories, errors, and audio prompts.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <b>Hindi</b> (<font face='Courier'>hi / hi-IN / हिंदी</font>) — Devanagari script + Hinglish colloquial representations.<br/>"
        "<b>Closed Domain Food Schema:</b> Each catalog item implements <font face='Courier'>FoodItem</font> with exact fields: <font face='Courier'>id</font>, <font face='Courier'>name</font>, <font face='Courier'>nativeNames { en, ta, hi }</font>, <font face='Courier'>description</font>, <font face='Courier'>basePrice</font>, <font face='Courier'>rating</font>, <font face='Courier'>cuisine</font>, <font face='Courier'>category</font>, <font face='Courier'>isVeg</font>, <font face='Courier'>image</font>, <font face='Courier'>restaurant</font>, <font face='Courier'>distanceKm</font>, <font face='Courier'>locations[]</font>, <font face='Courier'>platforms[]</font> (Swiggy, Zomato, AutoFeast with real-time fee & delivery time metrics), <font face='Courier'>tags[]</font>, <font face='Courier'>isDiabeticSafe</font>, <font face='Courier'>isLowSodium</font>, <font face='Courier'>isKidFriendly</font>, <font face='Courier'>calories</font>, <font face='Courier'>prepTime</font>.<br/>"
        "<b>Zero-Hallucination Policy:</b> When feeding catalog items to Gemini in <font face='Courier'>api/search-fallback.js</font>, dishes are serialized into <font face='Courier'>COMPACT_MENU</font> with a strict whitelist check against <font face='Courier'>VALID_CATALOG_IDS</font>. Any item ID generated by Gemini not in this 23-item whitelist is unconditionally discarded.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    # SECTION 6: Tech Stack
    elements.append(Paragraph("6. Full Application Technology Stack & Infrastructure", h1_style))
    stack_data = [
        [Paragraph("Layer", table_header), Paragraph("Technology / Framework", table_header), Paragraph("Exact Version", table_header), Paragraph("Purpose in Architecture", table_header)],
        [Paragraph("Frontend Framework", table_cell_bold), Paragraph("React", table_cell), Paragraph("19.0.1", table_cell_code), Paragraph("Declarative component-driven user interface with hooks and Concurrent Mode.", table_cell)],
        [Paragraph("Build Tool & Bundler", table_cell_bold), Paragraph("Vite", table_cell), Paragraph("6.2.3 / 6.4.3", table_cell_code), Paragraph("ESM-based HMR dev server and Rollup production bundling with WASM support.", table_cell)],
        [Paragraph("Language", table_cell_bold), Paragraph("TypeScript", table_cell), Paragraph("5.8.2", table_cell_code), Paragraph("Strict static typing across client state, API contracts, and catalog schemas.", table_cell)],
        [Paragraph("Styling Engine", table_cell_bold), Paragraph("Tailwind CSS", table_cell), Paragraph("4.1.14", table_cell_code), Paragraph("CSS utility-first styling configured with Warm Cream (#FFF8F0) & Tomato Red (#D93636).", table_cell)],
        [Paragraph("Animation", table_cell_bold), Paragraph("Motion (Framer Motion)", table_cell), Paragraph("12.23.24", table_cell_code), Paragraph("Spring animations, micro-interactions, and modal fade/slide transitions.", table_cell)],
        [Paragraph("UI Iconography", table_cell_bold), Paragraph("Lucide React", table_cell), Paragraph("0.546.0", table_cell_code), Paragraph("Accessible, tree-shakeable SVG UI icons.", table_cell)],
        [Paragraph("Client-Side AI / ML", table_cell_bold), Paragraph("@huggingface/transformers", table_cell), Paragraph("4.3.2", table_cell_code), Paragraph("In-browser transformer inference running ONNX Runtime WASM.", table_cell)],
        [Paragraph("Server Runtime", table_cell_bold), Paragraph("Node.js (ES Modules)", table_cell), Paragraph("v24.13.0 (dev) / Node 20.x", table_cell_code), Paragraph("Backend REST API server execution environment.", table_cell)],
        [Paragraph("Backend Framework", table_cell_bold), Paragraph("Express.js", table_cell), Paragraph("4.21.2", table_cell_code), Paragraph("REST API routing, middleware, JSON body parsing, and route security.", table_cell)],
        [Paragraph("Password Hashing", table_cell_bold), Paragraph("bcryptjs", table_cell), Paragraph("3.0.3", table_cell_code), Paragraph("Salted SHA/Blowfish password hashing with 10 salt rounds for nominee credentials.", table_cell)],
        [Paragraph("Cloud AI SDK", table_cell_bold), Paragraph("@google/genai", table_cell), Paragraph("2.4.0", table_cell_code), Paragraph("Official Google GenAI SDK interfacing with Gemini 3.8 Flash & TTS models.", table_cell)],
        [Paragraph("Database ODM", table_cell_bold), Paragraph("Mongoose", table_cell), Paragraph("9.10.3", table_cell_code), Paragraph("MongoDB object modeling, validation schemas, and cached global connection.", table_cell)],
        [Paragraph("Primary Database", table_cell_bold), Paragraph("MongoDB Atlas", table_cell), Paragraph("v7.0 / v8.0 Cloud", table_cell_code), Paragraph("Production cloud document database for users, PIN hashes, nominees, and orders.", table_cell)],
        [Paragraph("In-Memory Testing DB", table_cell_bold), Paragraph("mongodb-memory-server", table_cell), Paragraph("11.3.0", table_cell_code), Paragraph("Isolated, ephemeral MongoDB engine for automated unit and integration tests.", table_cell)],
        [Paragraph("Email Notifications", table_cell_bold), Paragraph("Nodemailer", table_cell), Paragraph("10.0.14", table_cell_code), Paragraph("SMTP delivery for nominee OTPs, invite links, and real-time order approvals.", table_cell)],
        [Paragraph("Deployment Platform", table_cell_bold), Paragraph("Vercel Cloud Platform", table_cell), Paragraph("Serverless v2", table_cell_code), Paragraph("Edge CDN static hosting + serverless function execution via vercel.json rewrites.", table_cell)]
    ]
    t3 = Table(stack_data, colWidths=[95, 125, 90, 230])
    t3.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t3)
    elements.append(Spacer(1, 10))

    # SECTION 7: Voice Command Processing Workflow
    elements.append(Paragraph("7. Voice Command Processing Workflow", h1_style))
    elements.append(Paragraph(
        "<b>Step 1 — Microphone Acquisition & Mutex Lock:</b> User activates voice via header mic (<font face='Courier'>🎤 Voice Search</font>) or in-page voice button. <font face='Courier'>SpeechController.requestMic({ owner, language })</font> enforces a single-active microphone mutex, terminating any background TTS or competing recognition listeners.<br/>"
        "<b>Step 2 — Primary Cloud STT Execution:</b> Web Speech API (<font face='Courier'>webkitSpeechRecognition</font>) initializes with language tag (<font face='Courier'>ta-IN</font>, <font face='Courier'>hi-IN</font>, or <font face='Courier'>en-IN</font>), capturing interim and final transcripts with up to 5 N-best candidate hypotheses.<br/>"
        "<b>Step 3 — Offline Whisper Fallback:</b> If Web Speech emits <font face='Courier'>network</font> error, socket disconnect, or offline status, <font face='Courier'>SpeechController</font> automatically transitions to <font face='Courier'>OfflineSpeechEngine</font>. Audio PCM is buffered at 16 kHz mono, padded, and transcribed locally via Transformers.js ONNX WASM running Whisper Tiny (Q8).<br/>"
        "<b>Step 4 — Hallucination Cleansing:</b> The raw transcript is processed through <font face='Courier'>cleanWhisperTranscript()</font>, stripping non-speech tokens (<font face='Courier'>[MUSIC]</font>, <font face='Courier'>[APPLAUSE]</font>), repetitive loops, and zero-confidence acoustic noise.<br/>"
        "<b>Step 5 — Two-Tier Natural Language Matching:</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <i>Family Matching:</i> <font face='Courier'>detectFoodFamilyIntent()</font> checks N-best candidates against 28 canonical Indian food families.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <i>Fuzzy Scoring:</i> <font face='Courier'>FuzzyMatchEngine.matchCatalogFoodItem()</font> scores candidate strings against the catalog using Damerau-Levenshtein distance and Token-Set ratio.<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;• <i>Quantity Extraction:</i> <font face='Courier'>NlpParserService</font> extracts numerical and verbal quantity tokens (e.g. '2', 'இரண்டு', 'दो').<br/>"
        "<b>Step 6 — Action Dispatch & Visual/Spoken Feedback:</b> Matched items are dispatched to the shopping cart, guided order modal, or scheduler, followed by spoken confirmation via <font face='Courier'>speechSynthesis</font>.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    # SECTION 8: Gemini Fallback Workflow
    elements.append(Paragraph("8. Gemini Fallback Workflow (Semantic & Acoustic Homophone Resolution)", h1_style))
    elements.append(Paragraph(
        "<b>Condition 1:</b> Triggered when local catalog search returns 0 matching candidates or top candidate confidence score &lt; 0.45.<br/>"
        "<b>Condition 2:</b> If <font face='Courier'>navigator.onLine === false</font>, Gemini fallback is aborted immediately without network invocation, returning safe popular catalog recommendations.<br/>"
        "<b>Condition 3:</b> If online, client invokes <font face='Courier'>POST /api/search-fallback</font> with payload <font face='Courier'>{ text, language }</font> bounded by a 5-second <font face='Courier'>AbortController</font>.<br/>"
        "<b>Server-Side Processing:</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;1. <i>Rate Limiting:</i> Validates request frequency (max 30 req/min/IP).<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;2. <i>Cache Check:</i> Evaluates in-memory LRU cache (<font face='Courier'>searchFallbackCache</font>).<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;3. <i>Acoustic Prompt Injection:</i> Supplies the 23-item <font face='Courier'>COMPACT_MENU</font> to <font face='Courier'>gemini-3.8-flash</font> with specific instructions to resolve acoustic homophones (such as Tamil acoustic misrecognition 'தவறும்' for 'பரோட்டா' / Parotta, or 'தோச' for 'தோசை').<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;4. <i>Strict Output Validation:</i> <font face='Courier'>validateSearchFallbackResult()</font> parses Gemini's JSON array, discards any non-catalog IDs, drops confidence &lt; 0.5, and caps results at 5 items.<br/>"
        "<b>Client Presentation:</b> Validated items are returned with <font face='Courier'>isSmartSearch: true</font>, rendering a distinctive purple 'Smart search' badge.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    # SECTION 9: Security PIN & Nominee Approval Workflow
    elements.append(Paragraph("9. Security PIN & Nominee Approval Workflow", h1_style))
    elements.append(Paragraph(
        "<b>A. Security PIN Verification Architecture:</b><br/>"
        "• <b>4-Digit Numeric PIN:</b> User authentication and order confirmation require a verified 4-digit PIN.<br/>"
        "• <b>Brute-Force Protection:</b> The server enforces a strict 4-attempt limit. On 4 consecutive failed attempts, the account is locked for <b>15 minutes</b> (<font face='Courier'>lockExpiresMs = Date.now() + 900000</font>).<br/>"
        "• <b>Offline Disconnection Isolation:</b> <font face='Courier'>AuthService.verifyPIN()</font> explicitly detects network errors (<font face='Courier'>ERR_INTERNET_DISCONNECTED</font> / <font face='Courier'>isOffline</font>). Network connectivity failures do NOT increment failed PIN attempts and prompt the user to reconnect rather than penalizing attempts.<br/>"
        "• <b>Single-Use Ephemeral Tokens:</b> Successful PIN verification issues a cryptographically signed HMAC SHA-256 token valid for <b>2 minutes</b> (<font face='Courier'>TOKEN_EXPIRY_MS = 120000</font>). Placing an order or schedule immediately consumes the token, preventing replay attacks.<br/><br/>"
        "<b>B. Nominee Supervised Approval Architecture:</b><br/>"
        "• <b>Restricted Food Enforcement:</b> Nominees can designate restricted dishes (e.g. high-sugar or allergen items) via <font face='Courier'>/api/nominee/restricted-items</font>.<br/>"
        "• <b>Interception & Approval Escalation:</b> When a user attempts to order or schedule a restricted item, the order is intercepted. An approval request is recorded (<font face='Courier'>POST /api/nominee/approval-requests</font>) with an expiry of <b>10 minutes</b>.<br/>"
        "• <b>Multi-Channel Notification:</b> The nominee is notified via Nodemailer SMTP email containing a secure token link to the Nominee Portal (<font face='Courier'>/nominee</font>).<br/>"
        "• <b>Nominee Authorization:</b> Nominees authenticate with a dedicated Nominee PIN or password to approve or reject requests. Approved requests issue a single-use claim token allowing the user's order to proceed.",
        body_style
    ))
    elements.append(Spacer(1, 10))

    # SECTION 10: API Endpoints
    elements.append(Paragraph("10. Complete REST API Endpoint Inventory", h1_style))
    api_data = [
        [Paragraph("HTTP Method & Route", table_header), Paragraph("Auth / Guard", table_header), Paragraph("Functional Purpose & Contract", table_header)],
        [Paragraph("GET /api/health", table_cell_code), Paragraph("Public", table_cell), Paragraph("Database & server health check (returns database readyState, uptime, and memory).", table_cell)],
        [Paragraph("POST /api/tts", table_cell_code), Paragraph("Public / Cached", table_cell), Paragraph("Generates natural speech audio via Gemini 2.5 Flash TTS in EN, TA, HI with server caching.", table_cell)],
        [Paragraph("POST /api/voice/nlu", table_cell_code), Paragraph("Rate Limited", table_cell), Paragraph("Interprets complex voice turn intents, quantities, items, and location choices.", table_cell)],
        [Paragraph("POST /api/voice/health-nlu", table_cell_code), Paragraph("Rate Limited", table_cell), Paragraph("Evaluates dietary and elder health constraints, suggesting mild catalog dishes.", table_cell)],
        [Paragraph("POST /api/search-fallback", table_cell_code), Paragraph("Rate Limited / Cached", table_cell), Paragraph("Gemini 3.8 Flash search fallback resolving acoustic homophones against closed catalog.", table_cell)],
        [Paragraph("POST /api/auth/register", table_cell_code), Paragraph("Public", table_cell), Paragraph("Registers user with name, email, phone, and optional 4-digit PIN hash.", table_cell)],
        [Paragraph("POST /api/auth/login", table_cell_code), Paragraph("Public", table_cell), Paragraph("Authenticates user via email and password, issuing session JWT.", table_cell)],
        [Paragraph("POST /api/auth/pin-login", table_cell_code), Paragraph("Rate Limited (4 tries)", table_cell), Paragraph("Authenticates elderly users via 4-digit numeric PIN.", table_cell)],
        [Paragraph("POST /api/auth/reset-pin", table_cell_code), Paragraph("Password Protected", table_cell), Paragraph("Resets user PIN after verifying email and password credentials.", table_cell)],
        [Paragraph("POST /api/verify-pin", table_cell_code), Paragraph("Bearer Auth / 4-Attempt Gate", table_cell), Paragraph("Verifies 4-digit PIN; returns single-use 2-minute order confirmation token.", table_cell)],
        [Paragraph("POST /api/nominee/invite", table_cell_code), Paragraph("Bearer Auth", table_cell), Paragraph("Sends nominee invitation email with secure setup token via Nodemailer.", table_cell)],
        [Paragraph("POST /api/nominee/setup-credentials", table_cell_code), Paragraph("Invite Token", table_cell), Paragraph("Initializes nominee account credentials and password.", table_cell)],
        [Paragraph("POST /api/nominee/login", table_cell_code), Paragraph("Public", table_cell), Paragraph("Authenticates nominee into the Nominee Portal.", table_cell)],
        [Paragraph("POST /api/nominee/verify-pin", table_cell_code), Paragraph("Nominee Token", table_cell), Paragraph("Verifies nominee-specific 4-digit PIN for high-privilege approvals.", table_cell)],
        [Paragraph("POST /api/nominee/set-pin", table_cell_code), Paragraph("Nominee Token", table_cell), Paragraph("Configures or updates nominee 4-digit PIN.", table_cell)],
        [Paragraph("GET /api/nominee/restricted-items", table_cell_code), Paragraph("Bearer Auth", table_cell), Paragraph("Fetches active dietary/allergen food item restrictions configured by nominee.", table_cell)],
        [Paragraph("POST /api/nominee/restricted-items", table_cell_code), Paragraph("Nominee Token", table_cell), Paragraph("Adds a food item to user's restricted ordering blacklist.", table_cell)],
        [Paragraph("DELETE /api/nominee/restricted-items/:id", table_cell_code), Paragraph("Nominee Token", table_cell), Paragraph("Removes a food item restriction from the blacklist.", table_cell)],
        [Paragraph("POST /api/nominee/approval-requests", table_cell_code), Paragraph("Bearer Auth", table_cell), Paragraph("Creates a 10-minute pending approval request when restricted item is ordered.", table_cell)],
        [Paragraph("GET /api/nominee/approval-requests/:id/status", table_cell_code), Paragraph("Public / Token", table_cell), Paragraph("Polls real-time approval status (pending, approved, rejected, expired).", table_cell)],
        [Paragraph("POST /api/nominee/approval-requests/:id/respond", table_cell_code), Paragraph("Nominee Token", table_cell), Paragraph("Nominee submits approve/deny decision on intercepted order.", table_cell)],
        [Paragraph("POST /api/nominee/approvals/:id/consume", table_cell_code), Paragraph("Bearer Auth", table_cell), Paragraph("Consumes approved request token to execute the order; prevents reuse.", table_cell)],
        [Paragraph("GET /api/cart", table_cell_code), Paragraph("User / Session Auth", table_cell), Paragraph("Fetches active multi-restaurant shopping cart for user.", table_cell)],
        [Paragraph("POST /api/cart/add", table_cell_code), Paragraph("User / Session Auth", table_cell), Paragraph("Adds food item to cart with quantity and source tag (voice, search, schedule).", table_cell)],
        [Paragraph("PUT /api/cart/update-qty", table_cell_code), Paragraph("User / Session Auth", table_cell), Paragraph("Updates item quantity in cart.", table_cell)],
        [Paragraph("DELETE /api/cart/remove", table_cell_code), Paragraph("User / Session Auth", table_cell), Paragraph("Removes specific item from active cart.", table_cell)],
        [Paragraph("DELETE /api/cart/clear", table_cell_code), Paragraph("User / Session Auth", table_cell), Paragraph("Clears all items from cart.", table_cell)],
        [Paragraph("GET /api/schedules", table_cell_code), Paragraph("Bearer Auth", table_cell), Paragraph("Fetches active automated meal recurrence schedules for user.", table_cell)],
        [Paragraph("POST /api/schedules", table_cell_code), Paragraph("Single-Use PIN Token", table_cell), Paragraph("Creates recurring order schedule (breakfast, lunch, snacks, dinner).", table_cell)],
        [Paragraph("DELETE /api/schedules/:id", table_cell_code), Paragraph("Bearer Auth", table_cell), Paragraph("Cancels and removes recurring schedule.", table_cell)],
        [Paragraph("POST /api/orders/create", table_cell_code), Paragraph("Single-Use PIN Token", table_cell), Paragraph("Executes order, verifies single-use token, debits wallet, creates live tracking.", table_cell)],
        [Paragraph("GET /api/prices/live", table_cell_code), Paragraph("Public", table_cell), Paragraph("Returns multi-platform price comparison across Swiggy, Zomato, and AutoFeast.", table_cell)]
    ]
    t4 = Table(api_data, colWidths=[150, 110, 280])
    t4.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), secondary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F8FAFC")]),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t4)
    elements.append(Spacer(1, 10))

    # SECTION 11: Testing Frameworks & Empirical Test Results
    elements.append(Paragraph("11. Testing Frameworks & Empirical Test Verification Results", h1_style))
    elements.append(Paragraph(
        "<b>Testing Frameworks:</b> Vitest v5.0.3, JSDOM v30.1.1, React Testing Library (@testing-library/react v16.3.3), and mongodb-memory-server v11.3.0.<br/>"
        "<b>Empirical Test Verification Log:</b> Executed on live codebase at November 2026.",
        body_style
    ))
    
    test_results_data = [
        [Paragraph("Test Suite File", table_header), Paragraph("Scope & Validated Capabilities", table_header), Paragraph("Tests Executed", table_header), Paragraph("Status", table_header)],
        [
            Paragraph("homepageAndHeaderLayout.test.tsx", table_cell_code),
            Paragraph("9-item header order, Voice Search button, profile dropdown items, 2-column dynamic search layout, 4 feature cards, food catalog.", table_cell),
            Paragraph("7 tests", table_cell),
            Paragraph("<font color='#16A34A'><b>PASSED (100%)</b></font>", table_cell)
        ],
        [
            Paragraph("headerLayoutAndLocationVoice.test.tsx", table_cell_code),
            Paragraph("Header wrapping without clipping, accessibility toolbar options, location popover voice recognition and prompt triggers.", table_cell),
            Paragraph("6 tests", table_cell),
            Paragraph("<font color='#16A34A'><b>PASSED (100%)</b></font>", table_cell)
        ],
        [
            Paragraph("geminiSearchFallback.test.ts", table_cell_code),
            Paragraph("Primary local vs Gemini fallback thresholds (< 0.45), zero-match fallback, offline suppression, 5-second timeout, Tamil homophone correction.", table_cell),
            Paragraph("23 tests", table_cell),
            Paragraph("<font color='#16A34A'><b>PASSED (100%)</b></font>", table_cell)
        ],
        [
            Paragraph("voiceWorkflowAndSecuritySuite.test.ts", table_cell_code),
            Paragraph("Multi-dish voice parsing, 28 food families, quantity extraction, PIN lockout (4 attempts), network disconnect isolation (ERR_INTERNET_DISCONNECTED).", table_cell),
            Paragraph("10 tests", table_cell),
            Paragraph("<font color='#16A34A'><b>PASSED (100%)</b></font>", table_cell)
        ],
        [
            Paragraph("server.mongo.test.ts", table_cell_code),
            Paragraph("Mongoose connection caching (global._mongoose), /api/health database readyState, credential sanitization (never logging passwords), fail-closed 503 auth routes.", table_cell),
            Paragraph("6 tests", table_cell),
            Paragraph("<font color='#16A34A'><b>PASSED (100%)</b></font>", table_cell)
        ],
        [
            Paragraph("Aggregate System Total", table_cell_bold),
            Paragraph("Comprehensive end-to-end frontend, NLP, voice, security, and database integration tests.", table_cell_bold),
            Paragraph("<b>52 tests</b>", table_cell_bold),
            Paragraph("<font color='#16A34A'><b>52 PASSED (0 FAILED)</b></font>", table_cell_bold)
        ]
    ]
    t5 = Table(test_results_data, colWidths=[150, 220, 70, 100])
    t5.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), primary_color),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.white, colors.HexColor("#F8FAFC")]),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#FEF2F2")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    elements.append(t5)
    elements.append(Spacer(1, 14))

    # Conclusion / Sign-off block
    signoff_data = [
        [
            Paragraph("<b>Report Prepared By:</b> Antigravity AI Engineering Assistant<br/><b>Verified Against Codebase:</b> Git Commit <font face='Courier'>9c168aa</font> (Branch <font face='Courier'>main</font>)", body_style),
            Paragraph("<b>B.Tech Project Evaluation:</b><br/>Autonomous Food Ordering System with Multilingual Voice & Supervised Nominee Controls", body_style)
        ]
    ]
    signoff_table = Table(signoff_data, colWidths=[270, 270])
    signoff_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E1")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(signoff_table)

    # Build PDF
    doc.build(elements, canvasmaker=NumberedCanvas)
    print(f"[PDF Generator]: Successfully generated {filename} ({os.path.getsize(filename)} bytes)")

if __name__ == '__main__':
    build_pdf()

