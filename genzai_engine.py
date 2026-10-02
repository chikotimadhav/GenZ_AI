import os
import json
import re
import pickle
import shutil
import tempfile
import datetime
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pypdf

# Directory paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUNDLED_DATA_DIR = os.path.join(BASE_DIR, "data")
BUNDLED_DOCS_DIR = os.path.join(BUNDLED_DATA_DIR, "documents")
BUNDLED_STORE_DIR = os.path.join(BUNDLED_DATA_DIR, "genzai_store")
BUNDLED_STARTER_FILE = os.path.join(BUNDLED_DATA_DIR, "starter_dataset.json")

def _init_writable_dirs():
    """
    Ensures data, documents, and store directories are located in a writable location.
    In serverless environments (like Vercel or AWS Lambda), the deployment root is read-only,
    so we dynamically use /tmp/genzai_data and seed initial bundled assets.
    """
    is_writable = False
    try:
        os.makedirs(BUNDLED_DOCS_DIR, exist_ok=True)
        test_file = os.path.join(BUNDLED_DATA_DIR, f".write_test_{os.getpid()}")
        with open(test_file, "w") as f:
            f.write("ok")
        if os.path.exists(test_file):
            os.remove(test_file)
        is_writable = True
    except Exception:
        is_writable = False

    # If Vercel env var is present or bundled dir is not writable, use /tmp
    if is_writable and not os.environ.get("VERCEL"):
        data_dir = BUNDLED_DATA_DIR
    else:
        data_dir = os.path.join(tempfile.gettempdir(), "genzai_data")

    docs_dir = os.path.join(data_dir, "documents")
    store_dir = os.path.join(data_dir, "genzai_store")
    starter_file = os.path.join(data_dir, "starter_dataset.json")

    os.makedirs(docs_dir, exist_ok=True)
    os.makedirs(store_dir, exist_ok=True)

    # Seed files from bundled repository if using separate temp data directory
    if os.path.abspath(data_dir) != os.path.abspath(BUNDLED_DATA_DIR):
        if os.path.exists(BUNDLED_STARTER_FILE) and not os.path.exists(starter_file):
            try:
                shutil.copy2(BUNDLED_STARTER_FILE, starter_file)
            except Exception as e:
                print(f"[genZai] Starter copy notice: {e}")

        if os.path.exists(BUNDLED_DOCS_DIR):
            for fname in os.listdir(BUNDLED_DOCS_DIR):
                src = os.path.join(BUNDLED_DOCS_DIR, fname)
                dst = os.path.join(docs_dir, fname)
                if os.path.isfile(src) and not os.path.exists(dst):
                    try:
                        shutil.copy2(src, dst)
                    except Exception as e:
                        print(f"[genZai] Doc copy notice {fname}: {e}")

        if os.path.exists(BUNDLED_STORE_DIR):
            for fname in os.listdir(BUNDLED_STORE_DIR):
                src = os.path.join(BUNDLED_STORE_DIR, fname)
                dst = os.path.join(store_dir, fname)
                if os.path.isfile(src) and not os.path.exists(dst):
                    try:
                        shutil.copy2(src, dst)
                    except Exception as e:
                        print(f"[genZai] Store copy notice {fname}: {e}")

    return data_dir, docs_dir, store_dir, starter_file

DATA_DIR, DOCS_DIR, STORE_DIR, STARTER_FILE = _init_writable_dirs()

class GenZaiEngine:
    def __init__(self):
        self.chunks: List[Dict[str, Any]] = []
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.matrix = None
        self.virtual_documents: Dict[str, Dict[str, Any]] = {}
        self.deleted_docs: set = set()
        self.meta: Dict[str, Any] = {
            "model_name": "genZai",
            "version": "1.0.0",
            "creator": "Madhav",
            "trained": False,
            "trained_at": None,
            "total_documents": 0,
            "total_chunks": 0,
            "documents": []
        }
        self.load_store()
        
        # If no store exists yet, auto-train on starter dataset and docs
        if not self.chunks and (os.path.exists(STARTER_FILE) or os.path.exists(BUNDLED_STARTER_FILE)):
            self.train_model()

    def get_status(self) -> Dict[str, Any]:
        """Returns the current training and knowledge state of genZai."""
        docs = self.list_documents()
        return {
            "model_name": "genZai",
            "creator": "Madhav",
            "trained": self.meta.get("trained", False),
            "trained_at": self.meta.get("trained_at"),
            "total_documents": len(docs),
            "total_chunks": len(self.chunks),
            "documents": docs
        }

    def list_documents(self) -> List[Dict[str, Any]]:
        """Lists all files in the documents directory + starter dataset + virtual documents."""
        doc_list = []
        seen_names = set()
        
        # Starter dataset
        starter_path = STARTER_FILE if os.path.exists(STARTER_FILE) else BUNDLED_STARTER_FILE
        if os.path.exists(starter_path):
            size = os.path.getsize(starter_path)
            doc_list.append({
                "name": "starter_dataset.json",
                "type": "starter",
                "size_bytes": size,
                "size_formatted": self._format_size(size),
                "is_removable": False
            })
            seen_names.add("starter_dataset.json")
            
        IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
        
        # Files in writable DOCS_DIR
        if os.path.exists(DOCS_DIR):
            for fname in sorted(os.listdir(DOCS_DIR)):
                if fname in self.deleted_docs or fname in seen_names:
                    continue
                # If this is an image knowledge companion file and the image exists, avoid listing duplicate
                if fname.startswith("image_knowledge_"):
                    base_img_name = fname.replace("image_knowledge_", "").replace(".txt", "")
                    if any(os.path.exists(os.path.join(DOCS_DIR, f"{base_img_name}{ext}")) for ext in IMAGE_EXTS):
                        continue
                        
                fpath = os.path.join(DOCS_DIR, fname)
                if os.path.isfile(fpath):
                    size = os.path.getsize(fpath)
                    ext = os.path.splitext(fname)[1].lower()
                    doc_type = "image" if ext in IMAGE_EXTS or fname.startswith("image_knowledge_") else ext.replace(".", "")
                    doc_list.append({
                        "name": fname,
                        "type": doc_type,
                        "size_bytes": size,
                        "size_formatted": self._format_size(size),
                        "is_removable": True
                    })
                    seen_names.add(fname)

        # Files in BUNDLED_DOCS_DIR (if not already counted)
        if os.path.exists(BUNDLED_DOCS_DIR):
            for fname in sorted(os.listdir(BUNDLED_DOCS_DIR)):
                if fname in self.deleted_docs or fname in seen_names:
                    continue
                if fname.startswith("image_knowledge_"):
                    base_img_name = fname.replace("image_knowledge_", "").replace(".txt", "")
                    if any(os.path.exists(os.path.join(BUNDLED_DOCS_DIR, f"{base_img_name}{ext}")) for ext in IMAGE_EXTS):
                        continue
                fpath = os.path.join(BUNDLED_DOCS_DIR, fname)
                if os.path.isfile(fpath):
                    size = os.path.getsize(fpath)
                    ext = os.path.splitext(fname)[1].lower()
                    doc_type = "image" if ext in IMAGE_EXTS or fname.startswith("image_knowledge_") else ext.replace(".", "")
                    doc_list.append({
                        "name": fname,
                        "type": doc_type,
                        "size_bytes": size,
                        "size_formatted": self._format_size(size),
                        "is_removable": True
                    })
                    seen_names.add(fname)

        # Virtual in-memory documents
        for fname, info in self.virtual_documents.items():
            if fname not in seen_names and fname not in self.deleted_docs:
                ext = os.path.splitext(fname)[1].lower()
                doc_type = "image" if info.get("is_image") or ext in IMAGE_EXTS else (ext.replace(".", "") or "txt")
                doc_list.append({
                    "name": fname,
                    "type": doc_type,
                    "size_bytes": info["size"],
                    "size_formatted": self._format_size(info["size"]),
                    "is_removable": True
                })
                seen_names.add(fname)

        return doc_list

    def _format_size(self, size_bytes: int) -> str:
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        return f"{size_bytes / (1024 * 1024):.2f} MB"

    def delete_document(self, filename: str) -> bool:
        """Deletes a document from the documents folder and retrains."""
        deleted = False
        if filename in self.virtual_documents:
            del self.virtual_documents[filename]
            deleted = True

        target = os.path.join(DOCS_DIR, filename)
        if os.path.exists(target) and os.path.isfile(target):
            try:
                os.remove(target)
                deleted = True
            except Exception as e:
                print(f"[genZai] Notice removing target {target}: {e}")
                self.deleted_docs.add(filename)
                deleted = True
        else:
            self.deleted_docs.add(filename)
            deleted = True

        # Clean up any companion image knowledge file if an image was deleted
        IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
        ext = os.path.splitext(filename)[1].lower()
        if ext in IMAGE_EXTS:
            companion_name = f"image_knowledge_{os.path.splitext(filename)[0]}.txt"
            comp_path = os.path.join(DOCS_DIR, companion_name)
            if companion_name in self.virtual_documents:
                del self.virtual_documents[companion_name]
            if os.path.exists(comp_path):
                try:
                    os.remove(comp_path)
                except Exception:
                    pass
        elif filename.startswith("image_knowledge_"):
            base_img = filename.replace("image_knowledge_", "").replace(".txt", "")
            for img_ext in IMAGE_EXTS:
                img_path = os.path.join(DOCS_DIR, f"{base_img}{img_ext}")
                if os.path.exists(img_path):
                    try:
                        os.remove(img_path)
                    except Exception:
                        pass

        if deleted:
            self.train_model()
            return True
        return False

    def add_text_note(self, title: str, content: str) -> str:
        """Saves a raw text note or document directly into the documents repository."""
        safe_title = re.sub(r'[^a-zA-Z0-9_\- ]', '', title).strip().replace(" ", "_")
        if not safe_title:
            safe_title = f"note_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}"
        filename = f"{safe_title}.txt"
        filepath = os.path.join(DOCS_DIR, filename)

        # Include title in content body if not already present
        full_note_content = f"{title}\n\n{content}".strip() if title and title.lower() not in content.lower() else content

        # Store in virtual_documents so it is always present even if disk write has issues
        self.virtual_documents[filename] = {
            "title": title,
            "content": full_note_content,
            "size": len(full_note_content.encode("utf-8"))
        }
        if filename in self.deleted_docs:
            self.deleted_docs.remove(filename)

        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(full_note_content)
        except Exception as e:
            print(f"[genZai] Warning: could not write note file to disk ({filepath}): {e}")

        self.train_model()
        return filename

    def add_image_knowledge(self, image_filename: str, title: str, vision_analysis: str) -> str:
        """Saves and indexes multimodal visual intelligence extracted from an image into genZai."""
        safe_name = os.path.splitext(image_filename)[0]
        safe_name = re.sub(r'[^a-zA-Z0-9_\- ]', '', safe_name).strip().replace(" ", "_") or "image_asset"
        knowledge_fname = f"image_knowledge_{safe_name}.txt"
        filepath = os.path.join(DOCS_DIR, knowledge_fname)

        full_content = (
            f"[Image Source: {image_filename}]\n"
            f"Topic: {title or image_filename}\n\n"
            f"Visual Intelligence, Text & Key Facts:\n"
            f"{vision_analysis}"
        )

        self.virtual_documents[knowledge_fname] = {
            "title": f"Image: {title or image_filename}",
            "content": full_content,
            "size": len(full_content.encode("utf-8")),
            "is_image": True,
            "image_filename": image_filename
        }
        if knowledge_fname in self.deleted_docs:
            self.deleted_docs.remove(knowledge_fname)

        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(full_content)
        except Exception as e:
            print(f"[genZai] Warning writing image knowledge file {filepath}: {e}")

        self.train_model()
        return knowledge_fname

    # ==========================================
    # Text Extraction & Chunking Pipeline
    # ==========================================
    def extract_text_from_file(self, filepath: str) -> List[Dict[str, Any]]:
        """Extracts text content and metadata from PDF, TXT, MD, JSON, CSV, and Images."""
        ext = os.path.splitext(filepath)[1].lower()
        filename = os.path.basename(filepath)
        items = []

        try:
            if ext == ".pdf":
                reader = pypdf.PdfReader(filepath)
                for page_idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    text = self._clean_text(text)
                    if text.strip():
                        items.append({
                            "source": filename,
                            "page": page_idx + 1,
                            "text": text
                        })

            elif ext in [".png", ".jpg", ".jpeg", ".webp", ".bmp"]:
                safe_name = os.path.splitext(filename)[0]
                companion = os.path.join(os.path.dirname(filepath), f"image_knowledge_{safe_name}.txt")
                if os.path.exists(companion):
                    with open(companion, "r", encoding="utf-8", errors="replace") as f:
                        content = self._clean_text(f.read())
                        if content.strip():
                            items.append({
                                "source": f"Image: {filename}",
                                "page": 1,
                                "text": content
                            })
                else:
                    items.append({
                        "source": f"Image: {filename}",
                        "page": 1,
                        "text": f"[Image Source: {filename}] Visual document trained into genZai."
                    })

            elif ext in [".txt", ".md", ".py", ".js", ".html"]:
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                    content = self._clean_text(content)
                    if content.strip():
                        source_name = f"Image: {filename.replace('image_knowledge_', '').replace('.txt', '')}" if filename.startswith("image_knowledge_") else filename
                        items.append({
                            "source": source_name,
                            "page": 1,
                            "text": content
                        })

            elif ext == ".json":
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                    data = json.load(f)
                    
                if isinstance(data, dict):
                    # Check for starter dataset format
                    if "knowledge_items" in data and isinstance(data["knowledge_items"], list):
                        for item in data["knowledge_items"]:
                            title = item.get("title", "")
                            text = item.get("content", "")
                            items.append({
                                "source": f"{filename} ({title})" if title else filename,
                                "page": 1,
                                "text": f"{title}\n{text}".strip()
                            })
                    else:
                        # General dict format
                        for k, v in data.items():
                            val_str = json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else str(v)
                            items.append({
                                "source": f"{filename} [{k}]",
                                "page": 1,
                                "text": f"{k}: {val_str}"
                            })
                elif isinstance(data, list):
                    for idx, row in enumerate(data):
                        if isinstance(row, dict):
                            # Q&A pair check
                            q = row.get("question") or row.get("instruction") or row.get("prompt") or ""
                            a = row.get("answer") or row.get("response") or row.get("output") or ""
                            if q and a:
                                items.append({
                                    "source": f"{filename} [Q&A #{idx+1}]",
                                    "page": 1,
                                    "text": f"Question: {q}\nAnswer: {a}"
                                })
                            else:
                                items.append({
                                    "source": f"{filename} [Entry #{idx+1}]",
                                    "page": 1,
                                    "text": json.dumps(row, ensure_ascii=False)
                                })
                        else:
                            items.append({
                                "source": f"{filename} [Row #{idx+1}]",
                                "page": 1,
                                "text": str(row)
                            })

            elif ext == ".csv":
                import csv
                with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                    reader = csv.DictReader(f)
                    for idx, row in enumerate(reader):
                        row_text = ", ".join(f"{k}: {v}" for k, v in row.items() if v)
                        if row_text.strip():
                            items.append({
                                "source": f"{filename} [Row #{idx+1}]",
                                "page": 1,
                                "text": row_text
                            })

        except Exception as e:
            print(f"[genZai] Error reading {filepath}: {e}")

        return items

    def _clean_text(self, text: str) -> str:
        text = re.sub(r'\r\n|\r', '\n', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    def _chunk_text(self, item: Dict[str, Any], chunk_size: int = 500, overlap: int = 100) -> List[Dict[str, Any]]:
        text = item["text"]
        source = item["source"]
        page = item.get("page", 1)

        # If short text, return as single chunk
        if len(text) <= chunk_size + 50:
            return [{
                "id": f"{source}_{page}_c0",
                "source": source,
                "page": page,
                "text": text,
                "char_count": len(text)
            }]

        chunks = []
        start = 0
        c_idx = 0
        while start < len(text):
            end = start + chunk_size
            # Try to snap to sentence or paragraph break
            if end < len(text):
                period_idx = text.rfind(". ", start + chunk_size // 2, end)
                newline_idx = text.rfind("\n", start + chunk_size // 2, end)
                best_split = max(period_idx, newline_idx)
                if best_split != -1:
                    end = best_split + 1

            chunk_content = text[start:end].strip()
            if chunk_content:
                chunks.append({
                    "id": f"{source}_{page}_c{c_idx}",
                    "source": source,
                    "page": page,
                    "text": chunk_content,
                    "char_count": len(chunk_content)
                })
                c_idx += 1

            start = end - overlap if end < len(text) else len(text)

        return chunks

    # ==========================================
    # Training & Vector Indexing
    # ==========================================
    def train_model(self) -> Dict[str, Any]:
        """Indexes all documents and builds the vector search store for genZai."""
        all_chunks: List[Dict[str, Any]] = []
        processed_sources = set()

        # 1. Process starter dataset
        starter_path = STARTER_FILE if os.path.exists(STARTER_FILE) else BUNDLED_STARTER_FILE
        if os.path.exists(starter_path):
            raw_items = self.extract_text_from_file(starter_path)
            for item in raw_items:
                all_chunks.extend(self._chunk_text(item))
            processed_sources.add("starter_dataset.json")

        # 2. Process all uploaded documents in writable DOCS_DIR
        if os.path.exists(DOCS_DIR):
            for fname in sorted(os.listdir(DOCS_DIR)):
                if fname in self.deleted_docs or fname in processed_sources:
                    continue
                fpath = os.path.join(DOCS_DIR, fname)
                if os.path.isfile(fpath):
                    raw_items = self.extract_text_from_file(fpath)
                    for item in raw_items:
                        all_chunks.extend(self._chunk_text(item))
                    processed_sources.add(fname)

        # 3. Process any documents in BUNDLED_DOCS_DIR (if not already read from DOCS_DIR)
        if os.path.exists(BUNDLED_DOCS_DIR):
            for fname in sorted(os.listdir(BUNDLED_DOCS_DIR)):
                if fname in self.deleted_docs or fname in processed_sources:
                    continue
                fpath = os.path.join(BUNDLED_DOCS_DIR, fname)
                if os.path.isfile(fpath):
                    raw_items = self.extract_text_from_file(fpath)
                    for item in raw_items:
                        all_chunks.extend(self._chunk_text(item))
                    processed_sources.add(fname)

        # 4. Process virtual in-memory documents
        for fname, info in self.virtual_documents.items():
            if fname in self.deleted_docs or fname in processed_sources:
                continue
            item = {
                "source": fname,
                "page": 1,
                "text": f"{info['title']}\n{info['content']}".strip()
            }
            all_chunks.extend(self._chunk_text(item))
            processed_sources.add(fname)

        if not all_chunks:
            # Fallback chunk if empty
            all_chunks.append({
                "id": "genzai_init",
                "source": "genZai Core",
                "page": 1,
                "text": "genZai is an AI model created and trained by Madhav with local document intelligence.",
                "char_count": 89
            })

        self.chunks = all_chunks

        # Train TF-IDF with sublinear scaling and 1-2 n-grams
        corpus = [c["text"] for c in all_chunks]
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
            sublinear_tf=True,
            min_df=1
        )
        self.matrix = self.vectorizer.fit_transform(corpus)

        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.meta = {
            "model_name": "genZai",
            "version": "1.0.0",
            "creator": "Madhav",
            "trained": True,
            "trained_at": now_str,
            "total_documents": len(self.list_documents()),
            "total_chunks": len(self.chunks)
        }

        # Persist to disk if writable
        self.save_store()

        return {
            "status": "success",
            "message": "genZai model successfully trained on your data!",
            "trained_at": now_str,
            "total_chunks": len(self.chunks),
            "total_documents": self.meta["total_documents"]
        }

    def save_store(self):
        """Saves current chunks, metadata, and vectorizer matrices."""
        try:
            os.makedirs(STORE_DIR, exist_ok=True)
            chunks_path = os.path.join(STORE_DIR, "chunks.json")
            with open(chunks_path, "w", encoding="utf-8") as f:
                json.dump(self.chunks, f, ensure_ascii=False, indent=2)

            meta_path = os.path.join(STORE_DIR, "meta.json")
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(self.meta, f, ensure_ascii=False, indent=2)

            if self.vectorizer is not None and self.matrix is not None:
                vec_path = os.path.join(STORE_DIR, "vectorizer.pkl")
                with open(vec_path, "wb") as f:
                    pickle.dump(self.vectorizer, f)

                mat_path = os.path.join(STORE_DIR, "matrix.pkl")
                with open(mat_path, "wb") as f:
                    pickle.dump(self.matrix, f)
        except Exception as e:
            print(f"[genZai] Notice saving store to disk: {e}")

    def load_store(self):
        """Loads chunks, metadata, and matrix from disk if available."""
        try:
            # Check writable STORE_DIR first, fallback to BUNDLED_STORE_DIR
            store_to_check = STORE_DIR if os.path.exists(os.path.join(STORE_DIR, "chunks.json")) else BUNDLED_STORE_DIR
            chunks_path = os.path.join(store_to_check, "chunks.json")
            meta_path = os.path.join(store_to_check, "meta.json")
            vec_path = os.path.join(store_to_check, "vectorizer.pkl")
            mat_path = os.path.join(store_to_check, "matrix.pkl")

            if os.path.exists(chunks_path):
                with open(chunks_path, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)

                if os.path.exists(meta_path):
                    with open(meta_path, "r", encoding="utf-8") as f:
                        self.meta = json.load(f)

                if os.path.exists(vec_path) and os.path.exists(mat_path):
                    with open(vec_path, "rb") as f:
                        self.vectorizer = pickle.load(f)
                    with open(mat_path, "rb") as f:
                        self.matrix = pickle.load(f)
                elif self.chunks:
                    # Rebuild TF-IDF vectorizer and matrix directly from loaded chunks
                    corpus = [c["text"] for c in self.chunks]
                    self.vectorizer = TfidfVectorizer(
                        ngram_range=(1, 2),
                        stop_words="english",
                        sublinear_tf=True,
                        min_df=1
                    )
                    self.matrix = self.vectorizer.fit_transform(corpus)
        except Exception as e:
            print(f"[genZai] Error loading store: {e}")

    # ==========================================
    # Retrieval Pipeline
    # ==========================================
    def retrieve_context(self, query: str, top_k: int = 4, threshold: float = 0.04) -> List[Dict[str, Any]]:
        """Retrieves top matching knowledge chunks for a given query."""
        if not self.chunks or self.vectorizer is None or self.matrix is None:
            return []

        try:
            # 1. TF-IDF Cosine Similarity
            query_vec = self.vectorizer.transform([query])
            sim_scores = cosine_similarity(query_vec, self.matrix)[0]

            # 2. Lexical keyword score bonus
            query_words = set(re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', query.lower()))
            
            scored_results = []
            for idx, score in enumerate(sim_scores):
                chunk = self.chunks[idx]
                chunk_text = chunk["text"].lower()
                
                # Keyword matches
                kw_matches = sum(1 for w in query_words if w in chunk_text)
                kw_ratio = (kw_matches / len(query_words)) if query_words else 0
                
                # Hybrid combined score
                final_score = (0.7 * float(score)) + (0.3 * kw_ratio)

                if final_score >= threshold:
                    scored_results.append({
                        "id": chunk["id"],
                        "source": chunk["source"],
                        "page": chunk.get("page", 1),
                        "text": chunk["text"],
                        "score": round(final_score, 4)
                    })

            # Sort by descending score
            scored_results.sort(key=lambda x: x["score"], reverse=True)
            return scored_results[:top_k]

        except Exception as e:
            print(f"[genZai] Retrieval error: {e}")
            return []

    def build_genzai_prompt(self, user_query: str, retrieved_chunks: List[Dict[str, Any]]) -> str:
        """Constructs the augmented prompt for genZai model."""
        if not retrieved_chunks:
            return (
                "You are genZai, a specialized AI model created and fine-tuned by Madhav. "
                "Respond intelligently, concisely, and helpfully."
            )

        context_blocks = []
        for i, chunk in enumerate(retrieved_chunks, 1):
            source_info = chunk['source']
            if chunk.get('page') and chunk.get('page') > 1:
                source_info += f", Page {chunk['page']}"
            context_blocks.append(f"[Source {i}: {source_info}]\n{chunk['text']}")

        joined_context = "\n\n---\n\n".join(context_blocks)

        system_instruction = (
            "You are genZai, an intelligent custom AI model trained and fine-tuned by Madhav.\n"
            "You possess specialized knowledge from your custom trained dataset.\n\n"
            "Below is verified knowledge retrieved from your training database relevant to the user query:\n"
            "==================== TRAINED KNOWLEDGE CONTEXT ====================\n"
            f"{joined_context}\n"
            "===================================================================\n\n"
            "Instructions:\n"
            "1. Prioritize and use the trained knowledge above to answer the user's question accurately.\n"
            "2. If the user asks who made you or what you are, state that you are genZai, created and trained by Madhav.\n"
            "3. When referencing specific facts from the training data, cite the source name (e.g. [Source: filename]).\n"
            "4. If the question cannot be answered from the trained knowledge, use your general reasoning while remaining helpful."
        )
        return system_instruction

# Global instance
engine = GenZaiEngine()
