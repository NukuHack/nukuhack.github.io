// src/lib.rs  —  compressor v2, Rust/WASM port
//
// Only two symbols are exported to JavaScript:
//   compress(text: &str, encode: &str, do_compress: bool) -> Result<String, JsValue>
//   decompress(compressed: &str)                          -> Result<JsValue, JsValue>
//
// decompress returns a JS object:  { text: string, meta: { version, timestamp,
//   origLen, checksum, salt } }
//
// ── CHANGE THESE BEFORE DISTRIBUTING ──────────────────────────────────────────
const PRNG_SEED:   u32 = 0xDEAD_BEEF;
const HEADER_SEED: u32 = 0xCAFE_BABE;
const MAGIC:       &str = "C2Fx";
const VERSION_STR: &str = "002";
// ──────────────────────────────────────────────────────────────────────────────

use wasm_bindgen::prelude::*;

// ─── constants ────────────────────────────────────────────────────────────────

const PRINT_START:  u8  = 32;
const PRINT_END:    u8  = 126;
const PRINT_RANGE:  u32 = (PRINT_END - PRINT_START) as u32 + 1; // 95
const BLOCK_SIZE:   usize = 16;
const HEADER_LEN:   usize = 64;
const SALT_LEN:     usize = 16;

const SEP_CANDIDATES: &[char] = &['$','^','~','`','#','@','!','%','&','*','+','=','<','>','?','/'];
const SALT_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&";

// ─── PRNG (same LCG as the JS version) ───────────────────────────────────────

struct Lcg(u32);

impl Lcg {
    fn new(seed: u32) -> Self { Self(seed) }
    fn next(&mut self) -> u32 {
        self.0 = self.0.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        self.0
    }
}

// ─── FNV-1a 32-bit ────────────────────────────────────────────────────────────

fn fnv32(s: &str) -> u32 {
    let mut h: u32 = 0x811c_9dc5;
    for b in s.bytes() {
        h ^= b as u32;
        h  = h.wrapping_mul(0x0100_0193);
    }
    h
}

// ─── Salt generation (uses getrandom → browser crypto.getRandomValues) ────────

fn generate_salt() -> String {
    let mut buf = [0u8; SALT_LEN];
    getrandom::getrandom(&mut buf).expect("getrandom failed");
    buf.iter()
       .map(|&b| SALT_CHARS[(b as usize) % SALT_CHARS.len()] as char)
       .collect()
}

// ─── Effective data seed ──────────────────────────────────────────────────────

fn effective_seed(salt: &str) -> u32 {
    fnv32(salt) ^ PRNG_SEED
}

// ─── Header cipher ────────────────────────────────────────────────────────────

fn cipher_header(plain: &str, encrypt: bool) -> String {
    let mut rng = Lcg::new(HEADER_SEED);
    plain.chars().map(|ch| {
        let c     = ch as u32;
        let shift = rng.next() % PRINT_RANGE;
        if c >= PRINT_START as u32 && c <= PRINT_END as u32 {
            let base = c - PRINT_START as u32;
            let out  = if encrypt {
                (base + shift) % PRINT_RANGE
            } else {
                (base + PRINT_RANGE - shift) % PRINT_RANGE
            };
            char::from_u32(out + PRINT_START as u32).unwrap()
        } else {
            ch
        }
    }).collect()
}

fn make_header(salt: &str, table_blob_len: usize, encode_mode: char,
               is_compressed: bool, sep: char, orig_len: usize, checksum: &str) -> Result<String, String> {
    let ts_ms = js_sys::Date::now() as u64;
    // FNV-32 hex is 1–8 chars; always zero-pad to exactly 8 so header length is deterministic
    let checksum8 = format!("{:0>8}", checksum);
    // salt must be exactly SALT_LEN chars; truncate or pad with '0' if needed
    let salt_fixed = format!("{:0<16}", &salt[..salt.len().min(SALT_LEN)]);
    let plain = format!(
        "{}{}{}{:013}{}{}{}{:07}{:08}{}_",
        MAGIC,          //  4  [0..4]
        VERSION_STR,    //  3  [4..7]
        salt_fixed,     // 16  [7..23]
        ts_ms,          // 13  [23..36]
        encode_mode,    //  1  [36]
        if is_compressed { 'c' } else { 'd' }, //  1  [37]
        sep,            //  1  [38]
        table_blob_len, //  7  [39..46]
        orig_len,       //  8  [46..54]
        checksum8,      //  8  [54..62]
                        //  1  [62] "_" reserved
    );
    let plain = format!("{} ", plain); // +1 space pad → total 64
    if plain.len() != HEADER_LEN {
        return Err(format!("Header length bug: got {}, expected {}", plain.len(), HEADER_LEN));
    }
    Ok(cipher_header(&plain, true))
}

struct Header {
    version:       String,
    salt:          String,
    timestamp:     f64,   // Unix ms (f64 matches JS Date)
    encode_mode:   char,
    is_compressed: bool,
    sep:           char,
    table_blob_len: usize,
    orig_len:      usize,
    checksum:      String,
}

fn parse_header(s: &str) -> Result<Header, String> {
    if s.len() < HEADER_LEN {
        return Err("Input too short to contain a valid header.".into());
    }
    let plain = cipher_header(&s[..HEADER_LEN], false);
    let p: Vec<char> = plain.chars().collect();

    let magic: String = p[0..4].iter().collect();
    if magic != MAGIC {
        return Err("Bad magic — wrong decoder, wrong seeds, or corrupt file.".into());
    }

    let version:    String = p[4..7].iter().collect();
    let salt:       String = p[7..23].iter().collect();
    let ts_str:     String = p[23..36].iter().collect();
    let timestamp   = ts_str.parse::<f64>().unwrap_or(0.0);
    let encode_mode = p[36];
    let is_compressed = p[37] == 'c';
    let sep         = p[38];
    let tbl_str:    String = p[39..46].iter().collect();
    let table_blob_len = tbl_str.trim_start_matches('0').parse::<usize>().unwrap_or(0);
    let orig_str:   String = p[46..54].iter().collect();
    let orig_len    = orig_str.trim_start_matches('0').parse::<usize>().unwrap_or(0);
    let checksum:   String = p[54..62].iter().collect::<String>().trim_start_matches('0').to_string();
    // p[62] = "_" reserved, p[63] = padding space

    if !['n','t','d','a'].contains(&encode_mode) {
        return Err(format!("Unknown encode mode '{}'.", encode_mode));
    }

    Ok(Header { version, salt, timestamp, encode_mode, is_compressed,
                sep, table_blob_len, orig_len, checksum })
}

// ─── Data cipher ──────────────────────────────────────────────────────────────

fn encode_str(s: &str, seed: u32) -> String {
    let chars: Vec<char> = s.chars().collect();
    let n = chars.len();
    let mut rng = Lcg::new(seed);

    // 1. shift each character
    let codes: Vec<u32> = chars.iter().map(|&ch| {
        let c     = ch as u32;
        let shift = rng.next() % PRINT_RANGE;
        if c >= PRINT_START as u32 && c <= PRINT_END as u32 {
            ((c - PRINT_START as u32 + shift) % PRINT_RANGE) + PRINT_START as u32
        } else {
            c
        }
    }).collect();

    // 2. Fisher-Yates block shuffle
    let num_blocks = n.div_ceil(BLOCK_SIZE);
    let mut order: Vec<usize> = (0..num_blocks).collect();
    for i in (1..num_blocks).rev() {
        let j = (rng.next() as usize) % (i + 1);
        order.swap(i, j);
    }

    // 3. emit blocks in shuffled order with 2-char length prefix
    let mut out = String::with_capacity(n + num_blocks * 2);
    for bi in 0..num_blocks {
        let src   = order[bi];
        let start = src * BLOCK_SIZE;
        let end   = n.min(start + BLOCK_SIZE);
        let len   = end - start;

        let hi = (len / PRINT_RANGE as usize) as u8 + PRINT_START;
        let lo = (len % PRINT_RANGE as usize) as u8 + PRINT_START;
        out.push(hi as char);
        out.push(lo as char);
        for k in start..end {
            out.push(char::from_u32(codes[k]).unwrap_or('?'));
        }
    }
    out
}

fn decode_str(s: &str, seed: u32) -> Result<String, String> {
    let chars: Vec<char> = s.chars().collect();
    let mut pos = 0;
    let mut blocks: Vec<Vec<char>> = Vec::new();

    while pos + 2 <= chars.len() {
        let hi  = chars[pos]     as u32 - PRINT_START as u32;
        let lo  = chars[pos + 1] as u32 - PRINT_START as u32;
        let len = (hi * PRINT_RANGE + lo) as usize;
        if pos + 2 + len > chars.len() {
            return Err("Corrupt data: block length overflows input.".into());
        }
        blocks.push(chars[pos + 2..pos + 2 + len].to_vec());
        pos += 2 + len;
    }

    let total_chars: usize = blocks.iter().map(|b| b.len()).sum();
    let num_blocks  = blocks.len();

    // replay the PRNG past the shift phase, then reproduce the shuffle
    let mut rng = Lcg::new(seed);
    for _ in 0..total_chars { rng.next(); }

    let mut order: Vec<usize> = (0..num_blocks).collect();
    for i in (1..num_blocks).rev() {
        let j = (rng.next() as usize) % (i + 1);
        order.swap(i, j);
    }

    // invert permutation
    let mut inv = vec![0usize; num_blocks];
    for (i, &src) in order.iter().enumerate() { inv[src] = i; }
    let reassembled: Vec<char> = inv.iter().flat_map(|&si| blocks[si].iter().copied()).collect();

    // undo character shift
    let mut rng2  = Lcg::new(seed);
    let result: String = reassembled.iter().map(|&ch| {
        let c     = ch as u32;
        let shift = rng2.next() % PRINT_RANGE;
        if c >= PRINT_START as u32 && c <= PRINT_END as u32 {
            let out = ((c - PRINT_START as u32 + PRINT_RANGE - shift) % PRINT_RANGE)
                      + PRINT_START as u32;
            char::from_u32(out).unwrap_or('?')
        } else {
            ch
        }
    }).collect();

    Ok(result)
}

// ─── Separator selection ──────────────────────────────────────────────────────

fn choose_sep(text: &str) -> Option<char> {
    SEP_CANDIDATES.iter().find(|&&c| !text.contains(c)).copied()
}

// ─── RLE ──────────────────────────────────────────────────────────────────────

fn apply_rle(text: &str, sep: char) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::new();
    let mut i   = 0;
    while i < chars.len() {
        let ch  = chars[i];
        let mut run = 1;
        while i + run < chars.len() && chars[i + run] == ch { run += 1; }
        // token: sep sep run sep ch sep
        let token = format!("{}{}{}{}{}", sep, sep, run, sep, ch);
        let token = format!("{}{}", token, sep);
        if token.len() < run {
            out.push_str(&token);
        } else {
            for _ in 0..run { out.push(ch); }
        }
        i += run;
    }
    out
}

fn reverse_rle(text: &str, sep: char) -> String {
    // Scan manually (no regex in core Rust)
    // Pattern:  sep sep <digits> sep <char> sep
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::new();
    let mut i   = 0;
    while i < chars.len() {
        if i + 4 < chars.len() && chars[i] == sep && chars[i + 1] == sep {
            // try to read: sep sep digits sep char sep
            let mut j = i + 2;
            while j < chars.len() && chars[j].is_ascii_digit() { j += 1; }
            if j > i + 2 && j + 2 <= chars.len() && chars[j] == sep && chars[j + 2] == sep {
                let run: usize = chars[i + 2..j].iter().collect::<String>()
                    .parse().unwrap_or(0);
                let ch = chars[j + 1];
                for _ in 0..run { out.push(ch); }
                i = j + 3;
                continue;
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

// ─── Dictionary table ─────────────────────────────────────────────────────────

fn ref_len(id: usize) -> usize { 2 + id.to_string().len() }
fn entry_overhead(phrase: &str) -> usize { phrase.len().to_string().len() + 1 + phrase.len() }

fn count_non_overlapping(text: &str, phrase: &str) -> usize {
    let mut count = 0;
    let mut pos   = 0;
    while let Some(idx) = text[pos..].find(phrase) {
        count += 1;
        pos   += idx + phrase.len();
    }
    count
}

fn build_table(text: &str, sep: char) -> (Vec<String>, std::collections::HashMap<String, usize>) {
    // tokenise on whitespace boundaries
    let mut tokens: Vec<String> = Vec::new();
    let mut buf = String::new();
    for ch in text.chars() {
        if ch.is_whitespace() {
            if !buf.is_empty() { tokens.push(buf.clone()); buf.clear(); }
            tokens.push(ch.to_string());
        } else {
            buf.push(ch);
        }
    }
    if !buf.is_empty() { tokens.push(buf); }

    let word_idx: Vec<usize> = tokens.iter().enumerate()
        .filter(|(_, t)| !t.trim().is_empty())
        .map(|(i, _)| i)
        .collect();

    let mut phrase_set: std::collections::HashSet<String> = std::collections::HashSet::new();
    for n in 1..=4usize {
        for wi in 0..word_idx.len().saturating_sub(n - 1) {
            let start_tok = word_idx[wi];
            let end_tok   = word_idx[wi + n - 1];
            let phrase: String = tokens[start_tok..=end_tok].join("");
            if phrase.len() >= 3 && !phrase.contains(sep) {
                phrase_set.insert(phrase);
            }
        }
    }

    let mut table:      Vec<String>                                    = Vec::new();
    let mut word_to_id: std::collections::HashMap<String, usize>      = std::collections::HashMap::new();
    let mut remaining = text.to_string();

    loop {
        let mut best_phrase: Option<String> = None;
        let mut best_net: i64 = 0;

        for phrase in &phrase_set {
            if phrase.contains(sep) { continue; }
            let id    = table.len();
            let rlen  = ref_len(id) as i64;
            if (phrase.len() as i64) <= rlen { continue; }
            let count = count_non_overlapping(&remaining, phrase) as i64;
            if count < 2 { continue; }
            let net = (phrase.len() as i64 - rlen) * count - entry_overhead(phrase) as i64;
            if net > best_net { best_net = net; best_phrase = Some(phrase.clone()); }
        }

        match best_phrase {
            None => break,
            Some(phrase) => {
                let id    = table.len();
                let token = format!("{}{}{}", sep, id, sep);
                remaining = remaining.replace(&phrase, &token);
                word_to_id.insert(phrase.clone(), id);
                table.push(phrase.clone());
                phrase_set.remove(&phrase);
            }
        }
    }

    (table, word_to_id)
}

fn apply_table(text: &str, word_to_id: &std::collections::HashMap<String, usize>, sep: char) -> String {
    if word_to_id.is_empty() { return text.to_string(); }

    // group phrases by first char for fast matching
    let mut by_first: std::collections::HashMap<char, Vec<&str>> = std::collections::HashMap::new();
    for phrase in word_to_id.keys() {
        let fc = phrase.chars().next().unwrap();
        by_first.entry(fc).or_default().push(phrase.as_str());
    }
    for v in by_first.values_mut() {
        v.sort_by(|a, b| b.len().cmp(&a.len()));
    }

    let mut out = String::new();
    let mut i   = 0;
    let chars: Vec<char> = text.chars().collect();

    while i < chars.len() {
        let ch = chars[i];
        if let Some(cands) = by_first.get(&ch) {
            let rest: String = chars[i..].iter().collect();
            let mut matched  = false;
            for &phrase in cands {
                if rest.starts_with(phrase) {
                    let id = word_to_id[phrase];
                    out.push_str(&format!("{}{}{}", sep, id, sep));
                    i += phrase.chars().count();
                    matched = true;
                    break;
                }
            }
            if !matched { out.push(ch); i += 1; }
        } else {
            out.push(ch); i += 1;
        }
    }
    out
}

fn reverse_table(text: &str, table: &[String], sep: char) -> String {
    // Scan for sep<digits>sep tokens
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::new();
    let mut i   = 0;
    while i < chars.len() {
        if chars[i] == sep && i + 1 < chars.len() {
            let mut j = i + 1;
            while j < chars.len() && chars[j].is_ascii_digit() { j += 1; }
            if j > i + 1 && j < chars.len() && chars[j] == sep {
                let id: usize = chars[i + 1..j].iter().collect::<String>()
                    .parse().unwrap_or(usize::MAX);
                if let Some(word) = table.get(id) {
                    out.push_str(word);
                    i = j + 1;
                    continue;
                }
            }
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}

fn serialize_table(table: &[String]) -> String {
    table.iter().map(|w| format!("{}_{}", w.len(), w)).collect()
}

fn deserialize_table(blob: &str) -> Vec<String> {
    let mut table = Vec::new();
    let mut i     = 0;
    let bytes     = blob.as_bytes();
    while i < bytes.len() {
        let mut j = i;
        while j < bytes.len() && bytes[j] != b'_' { j += 1; }
        if j >= bytes.len() { break; }
        let len: usize = blob[i..j].parse().unwrap_or(0);
        let word = blob[j + 1..].chars().take(len).collect();
        table.push(word);
        i = j + 1 + len;
    }
    table
}

// ─── WASM-exported API ────────────────────────────────────────────────────────

/// Compress and obfuscate `text`.
///
/// `encode` — one of "n" (none), "t" (table only), "d" (data only), "a" (all).
/// `do_compress` — apply dictionary + RLE before encrypting.
///
/// Returns the flat printable-ASCII ciphertext.
#[wasm_bindgen]
pub fn compress(text: &str, encode: &str, do_compress: bool) -> Result<String, JsValue> {
    let mut encode_mode = encode.chars().next().unwrap_or('a');
    if !['n','t','d','a'].contains(&encode_mode) {
        return Err(JsValue::from_str(&format!("Invalid encode mode \"{}\".", encode_mode)));
    }

    let salt      = generate_salt();
    let data_seed = effective_seed(&salt);
    let checksum  = format!("{:x}", fnv32(text));
    let orig_len  = text.len();

    let mut payload      = text.to_string();
    let mut encoded_early = false;

    let sep = match choose_sep(&payload) {
        Some(c) => c,
        None => {
            payload       = encode_str(&payload, data_seed);
            encoded_early = true;
            encode_mode   = 'a';
            choose_sep(&payload).unwrap_or(SEP_CANDIDATES[0])
        }
    };
    let (table, word_to_id) = if do_compress {
        build_table(&payload, sep)
    } else {
        (Vec::new(), std::collections::HashMap::new())
    };

    if do_compress {
        payload = apply_table(&payload, &word_to_id, sep);
        payload = apply_rle(&payload, sep);
    }

    let encode_data  = encode_mode == 'd' || encode_mode == 'a';
    let encode_table = encode_mode == 't' || encode_mode == 'a';

    if encode_data && !encoded_early {
        payload = encode_str(&payload, data_seed);
    }

    let mut table_blob = serialize_table(&table);
    if encode_table {
        table_blob = encode_str(&table_blob, data_seed);
    }

    let header = make_header(&salt, table_blob.len(), encode_mode,
                              do_compress, sep, orig_len, &checksum)
        .map_err(|e| JsValue::from_str(&e))?;

    Ok(header + &table_blob + &payload)
}

/// Decompress / decrypt a payload produced by `compress`.
///
/// Returns a JS object: `{ text: string, meta: { version, timestamp, origLen, checksum, salt } }`
#[wasm_bindgen]
pub fn decompress(compressed: &str) -> Result<JsValue, JsValue> {
    let hdr = parse_header(compressed)
        .map_err(|e| JsValue::from_str(&e))?;

    let data_seed = effective_seed(&hdr.salt);

    let table_start = HEADER_LEN;
    let table_end   = HEADER_LEN + hdr.table_blob_len;
    if table_end > compressed.len() {
        return Err(JsValue::from_str("Corrupt input: table blob overflows string."));
    }

    let mut table_blob: String = compressed.chars().skip(table_start).take(hdr.table_blob_len).collect();
    let mut payload:    String = compressed.chars().skip(table_end).collect();

    let decode_data  = hdr.encode_mode == 'd' || hdr.encode_mode == 'a';
    let decode_table = hdr.encode_mode == 't' || hdr.encode_mode == 'a';

    if decode_table {
        table_blob = decode_str(&table_blob, data_seed)
            .map_err(|e| JsValue::from_str(&e))?;
    }
    let table = deserialize_table(&table_blob);

    if decode_data {
        payload = decode_str(&payload, data_seed)
            .map_err(|e| JsValue::from_str(&e))?;
    }

    if hdr.is_compressed {
        payload = reverse_rle(&payload, hdr.sep);
        payload = reverse_table(&payload, &table, hdr.sep);
    }

    // Integrity checks
    if payload.len() != hdr.orig_len {
        return Err(JsValue::from_str(&format!(
            "Length mismatch: expected {} chars, got {}.", hdr.orig_len, payload.len()
        )));
    }
    let actual_cs = format!("{:x}", fnv32(&payload));
    if actual_cs != hdr.checksum {
        return Err(JsValue::from_str(
            "Checksum mismatch: file may be corrupt or was encoded with different seeds."
        ));
    }

    // Build return object via js_sys
    let obj  = js_sys::Object::new();
    let meta = js_sys::Object::new();

    js_sys::Reflect::set(&obj,  &"text".into(),      &payload.into()).unwrap();
    js_sys::Reflect::set(&meta, &"version".into(),   &hdr.version.into()).unwrap();
    js_sys::Reflect::set(&meta, &"timestamp".into(),
        &js_sys::Date::new(&JsValue::from_f64(hdr.timestamp)).into()).unwrap();
    js_sys::Reflect::set(&meta, &"origLen".into(),   &(hdr.orig_len as f64).into()).unwrap();
    js_sys::Reflect::set(&meta, &"checksum".into(),  &hdr.checksum.into()).unwrap();
    js_sys::Reflect::set(&meta, &"salt".into(),      &hdr.salt.into()).unwrap();
    js_sys::Reflect::set(&obj,  &"meta".into(),      &meta.into()).unwrap();

    Ok(obj.into())
}