/* zlib-deflate.js -- JavaScript implementation for the zlib deflate.
  Version: 0.2.0
  LastModified: Apr 12 2012
  Copyright (C) 2012 Masanao Izumo <iz@onicos.co.jp>

  This library is one of the JavaScript zlib implementation.
  Some API's are modified from the original.
  Only deflate API's are implemented.

  The original copyright notice (zlib 1.2.6):

  Copyright (C) 1995-2012 Jean-loup Gailly and Mark Adler

  This software is provided 'as-is', without any express or implied
  warranty.  In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

  1. The origin of this software must not be misrepresented; you must not
     claim that you wrote the original software. If you use this software
     in a product, an acknowledgment in the product documentation would be
     appreciated but is not required.
  2. Altered source versions must be plainly marked as such, and must not be
     misrepresented as being the original software.
  3. This notice may not be removed or altered from any source distribution.

  Jean-loup Gailly        Mark Adler
  jloup@gzip.org          madler@alumni.caltech.edu


  The data format used by the zlib library is described by RFCs (Request for
  Comments) 1950 to 1952 in the files http://tools.ietf.org/html/rfc1950
  (zlib format), rfc1951 (deflate format) and rfc1952 (gzip format).
*/

/*
                       API documentation
==============================================================================
Usage: z_stream = ZLIB.deflateInit([OPTIONS...]);

OPTIONS:
    level: TODO document

    method: TODO document

    windowBits: TODO document

    memLevel: TODO document

    strategy: TODO document

Ex: z_stream = ZLIB.deflateInit({level: 9});

     Create the stream object for compression.
     return null if failed.
     See zlib.h for parameter informations.


==============================================================================
Usage: encoded_string = z_stream.deflate(input_string [, {OPTIONS...}]);

OPTIONS:
    next_in: encode start offset for input_string.

    avail_in: // TODO document.  See zlib.h for the information.

    avail_out: // TODO document.  See zlib.h for the information.

    flush: // TODO document.  See zlib.h for the information.

Ex: encoded_string = z_stream.inflate(input_string);
    encoded_string = z_stream.inflate(input_string,
                         {next_in: 0,
                          avail_in: encoded_string.length,
                          avail_out: 1024,
                          flush: ZLIB.Z_NO_FLUSH});

     See zlib.h for more information.

==============================================================================
Usage: z_stream.deflateReset();
    TODO document

==============================================================================
Usage: z_stream.deflateTune(good_length, max_lazy, nice_length, max_chain);
    TODO document

==============================================================================
Usage: z_stream.deflateBound(sourceLen);
    TODO document
*/

if( typeof ZLIB === 'undefined' ) {
    alert('ZLIB is not defined.  SRC zlib.js before zlib-deflate.js')
}

(function() {

// deflate definition
ZLIB.Z_NO_COMPRESSION      =   0;
ZLIB.Z_BEST_SPEED          =   1;
ZLIB.Z_BEST_COMPRESSION    =   9;
ZLIB.Z_DEFAULT_COMPRESSION = (-1);
/* compression levels */

ZLIB.Z_FILTERED            = 1;
ZLIB.Z_HUFFMAN_ONLY        = 2;
ZLIB.Z_RLE                 = 3;
ZLIB.Z_FIXED               = 4;
ZLIB.Z_DEFAULT_STRATEGY    = 0;
/* compression strategy; see deflateInit2() below for details */

ZLIB.Z_BINARY   = 0;
ZLIB.Z_TEXT     = 1;
ZLIB.Z_ASCII    = ZLIB.Z_TEXT;   /* for compatibility with 1.2.2 and earlier */
ZLIB.Z_UNKNOWN  = 2;
/* Possible values of the data_type field (though see inflate()) */


/* Maximum value for memLevel in deflateInit2 */
ZLIB.MAX_MEM_LEVEL = 9;

/* Maximum value for windowBits in deflateInit2 and inflateInit2.
 * WARNING: reducing MAX_WBITS makes minigzip unable to extract .gz files
 * created by gzip. (Files created by minigzip can still be extracted by
 * gzip.)
 */
ZLIB.MAX_WBITS = 15;

/* deflate.c -- compress data using the deflation algorithm
 * Copyright (C) 1995-2012 Jean-loup Gailly and Mark Adler
 * For conditions of distribution and use, see copyright notice in zlib.h
 */

/*
 *  ALGORITHM
 *
 *      The "deflation" process depends on being able to identify portions
 *      of the input text which are identical to earlier input (within a
 *      sliding window trailing behind the input currently being processed).
 *
 *      The most straightforward technique turns out to be the fastest for
 *      most input files: try all possible matches and select the longest.
 *      The key feature of this algorithm is that insertions into the string
 *      dictionary are very simple and thus fast, and deletions are avoided
 *      completely. Insertions are performed at each input character, whereas
 *      string matches are performed only when the previous match ends. So it
 *      is preferable to spend more time in matches to allow very fast string
 *      insertions and avoid deletions. The matching algorithm for small
 *      strings is inspired from that of Rabin & Karp. A brute force approach
 *      is used to find longer strings when a small match has been found.
 *      A similar algorithm is used in comic (by Jan-Mark Wams) and freeze
 *      (by Leonid Broukhis).
 *         A previous version of this file used a more sophisticated algorithm
 *      (by Fiala and Greene) which is guaranteed to run in linear amortized
 *      time, but has a larger average cost, uses more memory and is patented.
 *      However the F&G algorithm may be faster for some highly redundant
 *      files if the parameter max_chain_length (described below) is too large.
 *
 *  ACKNOWLEDGEMENTS
 *
 *      The idea of lazy evaluation of matches is due to Jan-Mark Wams, and
 *      I found it in 'freeze' written by Leonid Broukhis.
 *      Thanks to many people for bug reports and testing.
 *
 *  REFERENCES
 *
 *      Deutsch, L.P.,"DEFLATE Compressed Data Format Specification".
 *      Available in http://tools.ietf.org/html/rfc1951
 *
 *      A description of the Rabin and Karp algorithm is given in the book
 *         "Algorithms" by R. Sedgewick, Addison-Wesley, p252.
 *
 *      Fiala,E.R., and Greene,D.H.
 *         Data Compression with Finite Windows, Comm.ACM, 32,4 (1989) 490-595
 *
 */
ZLIB.deflate_copyright =
   ' deflate 1.2.6 Copyright 1995-2012 Jean-loup Gailly and Mark Adler ';
/*
  If you use the zlib library in a product, an acknowledgment is welcome
  in the documentation of your product. If for some reason you cannot
  include such an acknowledgment, I would appreciate that you keep this
  copyright string in the executable of your product.
 */

ZLIB.OS_CODE = 0xff;
/*
0x00	FAT filesystem (MS-DOS, OS/2, NT/Win32)
0x01	Amiga
0x02	VMS (or OpenVMS)
0x03	Unix
0x04	VM/CMS
0x05	Atari TOS
0x06	HPFS filesystem (OS/2, NT)
0x07	Macintosh
0x08	Z-System
0x09	CP/M
0x0a	TOPS-20
0x0b	NTFS filesystem (NT)
0x0c	QDOS
0x0d	Acorn RISCOS
0x0f	Prime/PRIMOS
0xff	unknown
*/

var DEF_MEM_LEVEL;
if (ZLIB.MAX_MEM_LEVEL >= 8) {
    DEF_MEM_LEVEL = 8;
} else {
    DEF_MEM_LEVEL = ZLIB.MAX_MEM_LEVEL;
}
/* default memLevel */

var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES    = 2;
/* The three kinds of block type */

var MIN_MATCH = 3;
var MAX_MATCH = 258;
/* The minimum and maximum match lengths */

var PRESET_DICT = 0x20; /* preset dictionary flag in zlib header */

/* ===========================================================================
 * Internal compression state.
 */

var LENGTH_CODES = 29;
/* number of length codes, not counting the special END_BLOCK code */

var LITERALS  = 256;
/* number of literal bytes 0..255 */

var L_CODES = (LITERALS+1+LENGTH_CODES);
/* number of Literal or Length codes, including the END_BLOCK code */

var D_CODES   = 30;
/* number of distance codes */

var BL_CODES  = 19;
/* number of codes used to transfer the bit lengths */

var HEAP_SIZE = (2*L_CODES+1);
/* maximum heap size */

var MAX_BITS = 15;
/* All codes must not exceed MAX_BITS bits */

var Buf_size = 16;
/* size of bit buffer in bi_buf */

var INIT_STATE    = 42;
var EXTRA_STATE   = 69;
var NAME_STATE    = 73;
var COMMENT_STATE = 91;
var HCRC_STATE   = 103;
var BUSY_STATE   = 113;
var FINISH_STATE = 666;
/* Stream status */

function new_array(size)
{
    var i;
    var ary = new Array(size);
    for(i = 0; i < size; i++)
        ary[i] = 0;
    return ary;
}

function new_ct_array(count)
{
    var ary = new Array(count);
    var i;
    for(i = 0; i < count; i++) ary[i] = {fc:0, dl:0};
    return ary;
}

function getarg(opts, name, def_value)
{
    return (opts && (name in opts)) ? opts[name] : def_value;
}

function checksum_none()
{
	return 0;
}

/**
 * @constructor
 */
function tree_desc()
{
    this.dyn_tree = null;  /* the dynamic tree */
    this.max_code = 0;     /* largest code with non zero frequency */
    this.stat_desc = null; /* the corresponding static tree */
};

/**
 * @constructor
 */
function deflate_state()
{
    this.strm = null;       /* pointer back to this zlib stream (TODO remove: cross reference) */
    this.status = 0;        /* as the name implies */
    this.pending_buf = '';  /* output still pending */
    this.pending_buf_size = 0; /* size of pending_buf */
    this.wrap = 0;          /* bit 0 true for zlib, bit 1 true for gzip */
	this.gzhead = null;     /* TODO: gzip header information to write */
	this.gzindex = 0;       /* TODO: where in extra, name, or comment */
    this.method = 0;        /* STORED (for zip only) or DEFLATED */
    this.last_flush = 0;    /* value of flush param for previous deflate call */

                /* used by deflate.c: */

    this.w_size = 0;        /* LZ77 window size (32K by default) */
    this.w_bits = 0;        /* log2(w_size)  (8..16) */
    this.w_mask = 0;        /* w_size - 1 */

    this.window = null;
    /* Sliding window. Input bytes are read into the second half of the window,
     * and move to the first half later to keep a dictionary of at least wSize
     * bytes. With this organization, matches are limited to a distance of
     * wSize-MAX_MATCH bytes, but this ensures that IO is always
     * performed with a length multiple of the block size. Also, it limits
     * the window size to 64K, which is quite useful on MSDOS.
     * To do: use the user input buffer as sliding window.
     */

    this.window_size = 0;
    /* Actual size of window: 2*wSize, except when the user input buffer
     * is directly used as sliding window.
     */

    this.prev = null;
    /* Link to older string with same hash index. To limit the size of this
     * array to 64K, this link is maintained only for the last 32K strings.
     * An index in this array is thus a window index modulo 32K.
     */

    this.head = null; /* Heads of the hash chains or NIL. */

    this.ins_h = 0;          /* hash index of string to be inserted */
    this.hash_size = 0;      /* number of elements in hash table */
    this.hash_bits = 0;      /* log2(hash_size) */
    this.hash_mask = 0;      /* hash_size-1 */

    this.hash_shift = 0;
    /* Number of bits by which ins_h must be shifted at each input
     * step. It must be such that after MIN_MATCH steps, the oldest
     * byte no longer takes part in the hash key, that is:
     *   hash_shift * MIN_MATCH >= hash_bits
     */

    this.block_start = 0;
    /* Window position at the beginning of the current output block. Gets
     * negative when the window is moved backwards.
     */

    this.match_length = 0;           /* length of best match */
    this.prev_match = 0;             /* previous match */
    this.match_available = 0;         /* set if previous match exists */
    this.strstart = 0;               /* start of string to insert */
    this.match_start = 0;            /* start of matching string */
    this.lookahead = 0;              /* number of valid bytes ahead in window */

    this.prev_length = 0;
    /* Length of the best match at previous step. Matches not greater than this
     * are discarded. This is used in the lazy match evaluation.
     */

    this.max_chain_length = 0;
    /* To speed up deflation, hash chains are never searched beyond this
     * length.  A higher limit improves compression ratio but degrades the
     * speed.
     */

    this.max_lazy_match = 0;
    /* Attempt to find a better match only when the current match is strictly
     * smaller than this value. This mechanism is used only for compression
     * levels >= 4.
     */
//#   define max_insert_length  max_lazy_match
    /* Insert new strings in the hash table only if the match length is not
     * greater than this length. This saves time but degrades compression.
     * max_insert_length is used only for compression levels <= 3.
     */

    this.level = 0;    /* compression level (1..9) */
    this.strategy = 0; /* favor or force Huffman coding*/

    this.good_match = 0;
    /* Use a faster search when the previous match is longer than this */

    this.nice_match = 0; /* Stop searching when current match exceeds this */

                /* used by trees.c: */
    /* Didn't use ct_data typedef below to suppress compiler warning */
    this.dyn_ltree = new_ct_array(HEAP_SIZE);   /* literal and length tree */
    this.dyn_dtree = new_ct_array(2*D_CODES+1); /* distance tree */
    this.bl_tree = new_ct_array(2*BL_CODES+1);  /* Huffman tree for bit lengths */

    this.l_desc = new tree_desc();               /* desc. for literal tree */
    this.d_desc = new tree_desc();               /* desc. for distance tree */
    this.bl_desc = new tree_desc();              /* desc. for bit length tree */

    this.bl_count = new_array(MAX_BITS+1);
    /* number of codes at each bit length for an optimal tree */

    this.heap = new_array(2*L_CODES+1);      /* heap used to build the Huffman trees */
    this.heap_len = 0;               /* number of elements in the heap */
    this.heap_max = 0;               /* element of largest frequency */
    /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
     * The same heap array is used to build all trees.
     */

    this.depth = new_array(2*L_CODES+1);
    /* Depth of each subtree used as tie breaker for trees of equal frequency
     */

    this.l_buf = null;          /* buffer for literals or lengths */

    this.lit_bufsize = 0;
    /* Size of match buffer for literals/lengths.  There are 4 reasons for
     * limiting lit_bufsize to 64K:
     *   - frequencies can be kept in 16 bit counters
     *   - if compression is not successful for the first block, all input
     *     data is still in the window so we can still emit a stored block even
     *     when input comes from standard input.  (This can also be done for
     *     all blocks if lit_bufsize is not greater than 32K.)
     *   - if compression is not successful for a file smaller than 64K, we can
     *     even emit a stored file instead of a stored block (saving 5 bytes).
     *     This is applicable only for zip (not gzip or zlib).
     *   - creating new Huffman trees less frequently may not provide fast
     *     adaptation to changes in the input data statistics. (Take for
     *     example a binary file with poorly compressible code followed by
     *     a highly compressible string table.) Smaller buffer sizes give
     *     fast adaptation but have of course the overhead of transmitting
     *     trees more frequently.
     *   - I can't count above 4
     */

    this.last_lit = 0;      /* running index in l_buf */

    this.d_buf = null;
    /* Buffer for distances. To simplify the code, d_buf and l_buf have
     * the same number of elements. To use different lengths, an extra flag
     * array would be necessary.
     */

    this.opt_len = 0;        /* bit length of current block with optimal trees */
    this.static_len = 0;     /* bit length of current block with static trees */
    this.matches = 0;       /* number of string matches in current block */
    this.insert = 0;        /* bytes at end of window left to insert */

//#ifdef DEBUG
//    ulg compressed_len; /* total bit length of compressed file mod 2^32 */
//    ulg bits_sent;      /* bit length of compressed data sent mod 2^32 */
//#endif

    this.bi_buf = 0;
    /* Output buffer. bits are inserted starting at the bottom (least
     * significant bits).
     */
    this.bi_valid = 0;
    /* Number of valid bits in bi_buf.  All bits above the last valid bit
     * are always zero.
     */

    this.high_water = 0;
    /* High water mark offset in window for initialized bytes -- bytes above
     * this are set to zero in order to avoid memory check warnings when
     * longest match routines access bytes past the input.  This is then
     * updated to the new high water mark.
     */
}

var MIN_LOOKAHEAD = (MAX_MATCH+MIN_MATCH+1);
/* Minimum amount of lookahead, except at the end of the input file.
 * See deflate.c for comments about the MIN_MATCH+1.
 */

function MAX_DIST(s)
{
    return s.w_size-MIN_LOOKAHEAD;
}
/* In order to simplify the code, particularly on 16 bit machines, match
 * distances are limited to MAX_DIST instead of WSIZE.
 */

function d_code(dist)
{
    return dist < 256 ? _dist_code[dist] : _dist_code[256+(dist>>7)];
}
/* Mapping from a distance to a distance code. dist is the distance - 1 and
 * must not have side effects. _dist_code[256] and _dist_code[257] are never
 * used.
 */

var WIN_INIT = MAX_MATCH;
/* Number of bytes after end of data in window to initialize in order to avoid
   memory checker errors from longest match routines */

/* trees.c -- output deflated data using Huffman coding
 * Copyright (C) 1995-2012 Jean-loup Gailly
 * detect_data_type() function provided freely by Cosmin Truta, 2006
 * For conditions of distribution and use, see copyright notice in zlib.h
 */

/*
 *  ALGORITHM
 *
 *      The "deflation" process uses several Huffman trees. The more
 *      common source values are represented by shorter bit sequences.
 *
 *      Each code tree is stored in a compressed form which is itself
 * a Huffman encoding of the lengths of all the code strings (in
 * ascending order by source values).  The actual code strings are
 * reconstructed from the lengths in the inflate process, as described
 * in the deflate specification.
 *
 *  REFERENCES
 *
 *      Deutsch, L.P.,"'Deflate' Compressed Data Format Specification".
 *      Available in ftp.uu.net:/pub/archiving/zip/doc/deflate-1.1.doc
 *
 *      Storer, James A.
 *          Data Compression:  Methods and Theory, pp. 49-50.
 *          Computer Science Press, 1988.  ISBN 0-7167-8156-5.
 *
 *      Sedgewick, R.
 *          Algorithms, p290.
 *          Addison-Wesley, 1983. ISBN 0-201-06672-6.
 */

/* ===========================================================================
 * Constants
 */

var MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

var END_BLOCK = 256;
/* end of block literal code */

var REP_3_6      = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

var REPZ_3_10    = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

var REPZ_11_138  = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

var extra_lbits = /* extra bits for each length code */
    [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];

var extra_dbits = /* extra bits for each distance code */
    [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

var extra_blbits = /* extra bits for each bit length code */
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7];

var bl_order =
    [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

var DIST_CODE_LEN  = 512; /* see definition of array dist_code below */

var static_ltree = [
{fc: 12, dl:  8}, {fc:140, dl:  8}, {fc: 76, dl:  8}, {fc:204, dl:  8}, {fc: 44, dl:  8},
{fc:172, dl:  8}, {fc:108, dl:  8}, {fc:236, dl:  8}, {fc: 28, dl:  8}, {fc:156, dl:  8},
{fc: 92, dl:  8}, {fc:220, dl:  8}, {fc: 60, dl:  8}, {fc:188, dl:  8}, {fc:124, dl:  8},
{fc:252, dl:  8}, {fc:  2, dl:  8}, {fc:130, dl:  8}, {fc: 66, dl:  8}, {fc:194, dl:  8},
{fc: 34, dl:  8}, {fc:162, dl:  8}, {fc: 98, dl:  8}, {fc:226, dl:  8}, {fc: 18, dl:  8},
{fc:146, dl:  8}, {fc: 82, dl:  8}, {fc:210, dl:  8}, {fc: 50, dl:  8}, {fc:178, dl:  8},
{fc:114, dl:  8}, {fc:242, dl:  8}, {fc: 10, dl:  8}, {fc:138, dl:  8}, {fc: 74, dl:  8},
{fc:202, dl:  8}, {fc: 42, dl:  8}, {fc:170, dl:  8}, {fc:106, dl:  8}, {fc:234, dl:  8},
{fc: 26, dl:  8}, {fc:154, dl:  8}, {fc: 90, dl:  8}, {fc:218, dl:  8}, {fc: 58, dl:  8},
{fc:186, dl:  8}, {fc:122, dl:  8}, {fc:250, dl:  8}, {fc:  6, dl:  8}, {fc:134, dl:  8},
{fc: 70, dl:  8}, {fc:198, dl:  8}, {fc: 38, dl:  8}, {fc:166, dl:  8}, {fc:102, dl:  8},
{fc:230, dl:  8}, {fc: 22, dl:  8}, {fc:150, dl:  8}, {fc: 86, dl:  8}, {fc:214, dl:  8},
{fc: 54, dl:  8}, {fc:182, dl:  8}, {fc:118, dl:  8}, {fc:246, dl:  8}, {fc: 14, dl:  8},
{fc:142, dl:  8}, {fc: 78, dl:  8}, {fc:206, dl:  8}, {fc: 46, dl:  8}, {fc:174, dl:  8},
{fc:110, dl:  8}, {fc:238, dl:  8}, {fc: 30, dl:  8}, {fc:158, dl:  8}, {fc: 94, dl:  8},
{fc:222, dl:  8}, {fc: 62, dl:  8}, {fc:190, dl:  8}, {fc:126, dl:  8}, {fc:254, dl:  8},
{fc:  1, dl:  8}, {fc:129, dl:  8}, {fc: 65, dl:  8}, {fc:193, dl:  8}, {fc: 33, dl:  8},
{fc:161, dl:  8}, {fc: 97, dl:  8}, {fc:225, dl:  8}, {fc: 17, dl:  8}, {fc:145, dl:  8},
{fc: 81, dl:  8}, {fc:209, dl:  8}, {fc: 49, dl:  8}, {fc:177, dl:  8}, {fc:113, dl:  8},
{fc:241, dl:  8}, {fc:  9, dl:  8}, {fc:137, dl:  8}, {fc: 73, dl:  8}, {fc:201, dl:  8},
{fc: 41, dl:  8}, {fc:169, dl:  8}, {fc:105, dl:  8}, {fc:233, dl:  8}, {fc: 25, dl:  8},
{fc:153, dl:  8}, {fc: 89, dl:  8}, {fc:217, dl:  8}, {fc: 57, dl:  8}, {fc:185, dl:  8},
{fc:121, dl:  8}, {fc:249, dl:  8}, {fc:  5, dl:  8}, {fc:133, dl:  8}, {fc: 69, dl:  8},
{fc:197, dl:  8}, {fc: 37, dl:  8}, {fc:165, dl:  8}, {fc:101, dl:  8}, {fc:229, dl:  8},
{fc: 21, dl:  8}, {fc:149, dl:  8}, {fc: 85, dl:  8}, {fc:213, dl:  8}, {fc: 53, dl:  8},
{fc:181, dl:  8}, {fc:117, dl:  8}, {fc:245, dl:  8}, {fc: 13, dl:  8}, {fc:141, dl:  8},
{fc: 77, dl:  8}, {fc:205, dl:  8}, {fc: 45, dl:  8}, {fc:173, dl:  8}, {fc:109, dl:  8},
{fc:237, dl:  8}, {fc: 29, dl:  8}, {fc:157, dl:  8}, {fc: 93, dl:  8}, {fc:221, dl:  8},
{fc: 61, dl:  8}, {fc:189, dl:  8}, {fc:125, dl:  8}, {fc:253, dl:  8}, {fc: 19, dl:  9},
{fc:275, dl:  9}, {fc:147, dl:  9}, {fc:403, dl:  9}, {fc: 83, dl:  9}, {fc:339, dl:  9},
{fc:211, dl:  9}, {fc:467, dl:  9}, {fc: 51, dl:  9}, {fc:307, dl:  9}, {fc:179, dl:  9},
{fc:435, dl:  9}, {fc:115, dl:  9}, {fc:371, dl:  9}, {fc:243, dl:  9}, {fc:499, dl:  9},
{fc: 11, dl:  9}, {fc:267, dl:  9}, {fc:139, dl:  9}, {fc:395, dl:  9}, {fc: 75, dl:  9},
{fc:331, dl:  9}, {fc:203, dl:  9}, {fc:459, dl:  9}, {fc: 43, dl:  9}, {fc:299, dl:  9},
{fc:171, dl:  9}, {fc:427, dl:  9}, {fc:107, dl:  9}, {fc:363, dl:  9}, {fc:235, dl:  9},
{fc:491, dl:  9}, {fc: 27, dl:  9}, {fc:283, dl:  9}, {fc:155, dl:  9}, {fc:411, dl:  9},
{fc: 91, dl:  9}, {fc:347, dl:  9}, {fc:219, dl:  9}, {fc:475, dl:  9}, {fc: 59, dl:  9},
{fc:315, dl:  9}, {fc:187, dl:  9}, {fc:443, dl:  9}, {fc:123, dl:  9}, {fc:379, dl:  9},
{fc:251, dl:  9}, {fc:507, dl:  9}, {fc:  7, dl:  9}, {fc:263, dl:  9}, {fc:135, dl:  9},
{fc:391, dl:  9}, {fc: 71, dl:  9}, {fc:327, dl:  9}, {fc:199, dl:  9}, {fc:455, dl:  9},
{fc: 39, dl:  9}, {fc:295, dl:  9}, {fc:167, dl:  9}, {fc:423, dl:  9}, {fc:103, dl:  9},
{fc:359, dl:  9}, {fc:231, dl:  9}, {fc:487, dl:  9}, {fc: 23, dl:  9}, {fc:279, dl:  9},
{fc:151, dl:  9}, {fc:407, dl:  9}, {fc: 87, dl:  9}, {fc:343, dl:  9}, {fc:215, dl:  9},
{fc:471, dl:  9}, {fc: 55, dl:  9}, {fc:311, dl:  9}, {fc:183, dl:  9}, {fc:439, dl:  9},
{fc:119, dl:  9}, {fc:375, dl:  9}, {fc:247, dl:  9}, {fc:503, dl:  9}, {fc: 15, dl:  9},
{fc:271, dl:  9}, {fc:143, dl:  9}, {fc:399, dl:  9}, {fc: 79, dl:  9}, {fc:335, dl:  9},
{fc:207, dl:  9}, {fc:463, dl:  9}, {fc: 47, dl:  9}, {fc:303, dl:  9}, {fc:175, dl:  9},
{fc:431, dl:  9}, {fc:111, dl:  9}, {fc:367, dl:  9}, {fc:239, dl:  9}, {fc:495, dl:  9},
{fc: 31, dl:  9}, {fc:287, dl:  9}, {fc:159, dl:  9}, {fc:415, dl:  9}, {fc: 95, dl:  9},
{fc:351, dl:  9}, {fc:223, dl:  9}, {fc:479, dl:  9}, {fc: 63, dl:  9}, {fc:319, dl:  9},
{fc:191, dl:  9}, {fc:447, dl:  9}, {fc:127, dl:  9}, {fc:383, dl:  9}, {fc:255, dl:  9},
{fc:511, dl:  9}, {fc:  0, dl:  7}, {fc: 64, dl:  7}, {fc: 32, dl:  7}, {fc: 96, dl:  7},
{fc: 16, dl:  7}, {fc: 80, dl:  7}, {fc: 48, dl:  7}, {fc:112, dl:  7}, {fc:  8, dl:  7},
{fc: 72, dl:  7}, {fc: 40, dl:  7}, {fc:104, dl:  7}, {fc: 24, dl:  7}, {fc: 88, dl:  7},
{fc: 56, dl:  7}, {fc:120, dl:  7}, {fc:  4, dl:  7}, {fc: 68, dl:  7}, {fc: 36, dl:  7},
{fc:100, dl:  7}, {fc: 20, dl:  7}, {fc: 84, dl:  7}, {fc: 52, dl:  7}, {fc:116, dl:  7},
{fc:  3, dl:  8}, {fc:131, dl:  8}, {fc: 67, dl:  8}, {fc:195, dl:  8}, {fc: 35, dl:  8},
{fc:163, dl:  8}, {fc: 99, dl:  8}, {fc:227, dl:  8}
];

var static_dtree = [
{fc: 0, dl: 5}, {fc:16, dl: 5}, {fc: 8, dl: 5}, {fc:24, dl: 5}, {fc: 4, dl: 5},
{fc:20, dl: 5}, {fc:12, dl: 5}, {fc:28, dl: 5}, {fc: 2, dl: 5}, {fc:18, dl: 5},
{fc:10, dl: 5}, {fc:26, dl: 5}, {fc: 6, dl: 5}, {fc:22, dl: 5}, {fc:14, dl: 5},
{fc:30, dl: 5}, {fc: 1, dl: 5}, {fc:17, dl: 5}, {fc: 9, dl: 5}, {fc:25, dl: 5},
{fc: 5, dl: 5}, {fc:21, dl: 5}, {fc:13, dl: 5}, {fc:29, dl: 5}, {fc: 3, dl: 5},
{fc:19, dl: 5}, {fc:11, dl: 5}, {fc:27, dl: 5}, {fc: 7, dl: 5}, {fc:23, dl: 5}
];

var _dist_code = [
 0,  1,  2,  3,  4,  4,  5,  5,  6,  6,  6,  6,  7,  7,  7,  7,  8,  8,  8,  8,
 8,  8,  8,  8,  9,  9,  9,  9,  9,  9,  9,  9, 10, 10, 10, 10, 10, 10, 10, 10,
10, 10, 10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12,
12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 13,
13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13,
13, 13, 13, 13, 13, 13, 13, 13, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14,
14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14,
14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14,
14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15,
15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,
15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,  0,  0, 16, 17,
18, 18, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22, 22, 22,
23, 23, 23, 23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
24, 24, 24, 24, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25,
26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26,
26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 27, 27, 27, 27, 27, 27, 27, 27,
27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27,
27, 27, 27, 27, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
28, 28, 28, 28, 28, 28, 28, 28, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29,
29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29,
29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29,
29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29
];

var _length_code = [
 0,  1,  2,  3,  4,  5,  6,  7,  8,  8,  9,  9, 10, 10, 11, 11, 12, 12, 12, 12,
13, 13, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 16, 16, 16, 16,
17, 17, 17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 19, 19,
19, 19, 19, 19, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22,
22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 23, 23, 23, 23, 23, 23, 23,
23, 23, 23, 23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25,
25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 26, 26, 26, 26, 26, 26, 26, 26,
26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26, 26,
26, 26, 26, 26, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27,
27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 27, 28
];

var base_length = [
0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56,
64, 80, 96, 112, 128, 160, 192, 224, 0
];

var base_dist = [
    0,     1,     2,     3,     4,     6,     8,    12,    16,    24,
   32,    48,    64,    96,   128,   192,   256,   384,   512,   768,
 1024,  1536,  2048,  3072,  4096,  6144,  8192, 12288, 16384, 24576
];

var static_l_desc = {
    static_tree: static_ltree,
    extra_bits: extra_lbits,
    extra_base: LITERALS+1,
    elems: L_CODES,
    max_length: MAX_BITS};

var static_d_desc = {
    static_tree: static_dtree,
    extra_bits: extra_dbits,
    extra_base: 0,
    elems: D_CODES,
    max_length: MAX_BITS};

var static_bl_desc = {
    static_tree: null,
    extra_bits: extra_blbits,
    extra_base: 0,
    elems: BL_CODES,
    max_length: MAX_BL_BITS};

/* ===========================================================================
 * Local (static) routines in this file.
 */
function send_code(s, c, tree)
{
    return send_bits(s, tree[c].fc, tree[c].dl);
}
/* Send a code of the given tree. c and tree must not have side effects */

/* Output a byte on the stream.
 * IN assertion: there is enough room in pending_buf.
 */
function put_byte(s, c)
{
    s.pending_buf += String.fromCharCode(c);
}

/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
function put_short(s, w)
{
    s.pending_buf += String.fromCharCode(w & 0xff);
    s.pending_buf += String.fromCharCode((w >> 8) & 0xff);
}

function send_bits(s, value, length)
{
    s.bits_sent += length;

    /* If not enough room in bi_buf, use (valid) bits from bi_buf and
     * (16 - bi_valid) bits from value, leaving (width - (16-bi_valid))
     * unused bits in value.
     */
    if (s.bi_valid > Buf_size - length) {
        s.bi_buf |= value << s.bi_valid;
        put_short(s, s.bi_buf);
        s.bi_buf = value >> (Buf_size - s.bi_valid);
        s.bi_valid += length - Buf_size;
    } else {
        s.bi_buf |= value << s.bi_valid;
        s.bi_valid += length;
    }
}

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
function _tr_init(s)
{
    s.l_desc.dyn_tree = s.dyn_ltree;
    s.l_desc.stat_desc = static_l_desc;

    s.d_desc.dyn_tree = s.dyn_dtree;
    s.d_desc.stat_desc = static_d_desc;

    s.bl_desc.dyn_tree = s.bl_tree;
    s.bl_desc.stat_desc = static_bl_desc;

    s.bi_buf = 0;
    s.bi_valid = 0;
//#ifdef DEBUG
//    s->compressed_len = 0L;
//    s->bits_sent = 0L;
//#endif

    /* Initialize the first block of the first file: */
    init_block(s);
}

/* ===========================================================================
 * Initialize a new block.
 */
function init_block(s)
{
    var n; /* iterates over tree elements */

    /* Initialize the trees. */
    for (n = 0; n < L_CODES;  n++) s.dyn_ltree[n].fc = 0;
    for (n = 0; n < D_CODES;  n++) s.dyn_dtree[n].fc = 0;
    for (n = 0; n < BL_CODES; n++) s.bl_tree[n].fc = 0;

    s.dyn_ltree[END_BLOCK].fc = 1;
    s.opt_len = s.static_len = 0;
    s.last_lit = s.matches = 0;
}

var SMALLEST = 1;
/* Index within the heap array of least frequent node in the Huffman tree */

/* ===========================================================================
 * Remove the smallest element from the heap and recreate the heap with
 * one less element. Updates heap and heap_len.
 */
function pqremove(s, tree) //XXX TODO top = pqremove(s, tree);
{
    var top = s.heap[SMALLEST];
    s.heap[SMALLEST] = s.heap[s.heap_len--];
    pqdownheap(s, tree, SMALLEST);
    return top;
}

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
function smaller(tree, n, m, depth)
{
    return tree[n].fc < tree[m].fc ||
        (tree[n].fc == tree[m].fc && depth[n] <= depth[m]);
}

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
function pqdownheap(s, tree, k)
{
    var v = s.heap[k];
    var j = k << 1;  /* left son of k */
    while (j <= s.heap_len) {
        /* Set j to the smallest of the two sons: */
        if (j < s.heap_len &&
            smaller(tree, s.heap[j+1], s.heap[j], s.depth)) {
            j++;
        }
        /* Exit if v is smaller than both sons */
        if (smaller(tree, v, s.heap[j], s.depth)) break;

        /* Exchange v with the smallest son */
        s.heap[k] = s.heap[j];  k = j;

        /* And continue down the tree, setting j to the left son of k */
        j <<= 1;
    }
    s.heap[k] = v;
}

/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
function gen_bitlen(s, desc)
{
    var tree        = desc.dyn_tree;
    var max_code         = desc.max_code;
    var stree = desc.stat_desc.static_tree;
    var extra    = desc.stat_desc.extra_bits;
    var base             = desc.stat_desc.extra_base;
    var max_length       = desc.stat_desc.max_length;
    var h;              /* heap index */
    var n, m;           /* iterate over the tree elements */
    var bits;           /* bit length */
    var xbits;          /* extra bits */
    var f;              /* frequency */
    var overflow = 0;   /* number of elements with bit length too large */

    for (bits = 0; bits <= MAX_BITS; bits++) s.bl_count[bits] = 0;

    /* In a first pass, compute the optimal bit lengths (which may
     * overflow in the case of the bit length tree).
     */
    tree[s.heap[s.heap_max]].dl = 0; /* root of the heap */

    for (h = s.heap_max+1; h < HEAP_SIZE; h++) {
        n = s.heap[h];
        bits = tree[tree[n].dl].dl + 1;
        if (bits > max_length) { bits = max_length; overflow++; }
        tree[n].dl = bits;
        /* We overwrite tree[n].Dad which is no longer needed */

        if (n > max_code) continue; /* not a leaf node */

        s.bl_count[bits]++;
        xbits = 0;
        if (n >= base) xbits = extra[n-base];
        f = tree[n].fc;
        s.opt_len += f * (bits + xbits);
        if (stree) s.static_len += f * (stree[n].dl + xbits);
    }
    if (overflow == 0) return;

    //Trace((stderr,"\nbit length overflow\n"));
    /* This happens for example on obj2 and pic of the Calgary corpus */

    /* Find the first bit length which could increase: */
    do {
        bits = max_length-1;
        while (s.bl_count[bits] == 0) bits--;
        s.bl_count[bits]--;      /* move one leaf down the tree */
        s.bl_count[bits+1] += 2; /* move one overflow item as its brother */
        s.bl_count[max_length]--;
        /* The brother of the overflow item also moves one step up,
         * but this does not affect bl_count[max_length]
         */
        overflow -= 2;
    } while (overflow > 0);

    /* Now recompute all bit lengths, scanning in increasing frequency.
     * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
     * lengths instead of fixing only the wrong ones. This idea is taken
     * from 'ar' written by Haruhiko Okumura.)
     */
    for (bits = max_length; bits != 0; bits--) {
        n = s.bl_count[bits];
        while (n != 0) {
            m = s.heap[--h];
            if (m > max_code) continue;
            if (tree[m].dl != bits) {
                //Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
                s.opt_len += (bits - tree[m].dl) * tree[m].fc;
                tree[m].dl = bits;
            }
            n--;
        }
    }
}

/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
function gen_codes (tree, max_code, bl_count)
{
    var next_code = new Array(MAX_BITS+1); /* next code value for each bit length */
    var code = 0;              /* running code value */
    var bits;                  /* bit index */
    var n;                     /* code index */

    /* The distribution counts are first used to generate the code values
     * without bit reversal.
     */
    for (bits = 1; bits <= MAX_BITS; bits++) {
        next_code[bits] = code = (code + bl_count[bits-1]) << 1;
    }
    /* Check that the bit counts in bl_count are consistent. The last code
     * must be all ones.
     */
    //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
    //        "inconsistent bit counts");
    //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

    for (n = 0;  n <= max_code; n++) {
        var len = tree[n].dl;
        if (len == 0) continue;
        /* Now reverse the bits */
        tree[n].fc = bi_reverse(next_code[len]++, len);

        //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
        //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
    }
}

/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
function build_tree(s, desc)
{
    var tree         = desc.dyn_tree;
    var stree  = desc.stat_desc.static_tree;
    var elems             = desc.stat_desc.elems;
    var n, m;          /* iterate over heap elements */
    var max_code = -1; /* largest code with non zero frequency */
    var node;          /* new node being created */

    /* Construct the initial heap, with least frequent element in
     * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
     * heap[0] is not used.
     */
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE;

    for (n = 0; n < elems; n++) {
        if (tree[n].fc != 0) {
            s.heap[++(s.heap_len)] = max_code = n;
            s.depth[n] = 0;
        } else {
            tree[n].dl = 0;
        }
    }

    /* The pkzip format requires that at least one distance code exists,
     * and that at least one bit should be sent even if there is only one
     * possible code. So to avoid special checks later on we force at least
     * two codes of non zero frequency.
     */
    while (s.heap_len < 2) {
        node = s.heap[++(s.heap_len)] = (max_code < 2 ? ++max_code : 0);
        tree[node].fc = 1;
        s.depth[node] = 0;
        s.opt_len--;
        if (stree) s.static_len -= stree[node].dl;
        /* node is 0 or 1 so it does not have extra bits */
    }
    desc.max_code = max_code;

    /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
     * establish sub-heaps of increasing lengths:
     */
    for (n = s.heap_len>>1; n >= 1; n--) pqdownheap(s, tree, n);

    /* Construct the Huffman tree by repeatedly combining the least two
     * frequent nodes.
     */
    node = elems;              /* next internal node of the tree */
    do {
        n = pqremove(s, tree);  /* n = node of least frequency */
        m = s.heap[SMALLEST]; /* m = node of next least frequency */

        s.heap[--(s.heap_max)] = n; /* keep the nodes sorted by frequency */
        s.heap[--(s.heap_max)] = m;

        /* Create a new node father of n and m */
        tree[node].fc = tree[n].fc + tree[m].fc;
        s.depth[node] = ((s.depth[n] >= s.depth[m] ?
                          s.depth[n] : s.depth[m]) + 1);
        tree[n].dl = tree[m].dl = node;
//#ifdef DUMP_BL_TREE
//        if (tree == s->bl_tree) {
//            fprintf(stderr,"\nnode %d(%d), sons %d(%d) %d(%d)",
//                    node, tree[node].Freq, n, tree[n].Freq, m, tree[m].Freq);
//        }
//#endif
        /* and insert the new node in the heap */
        s.heap[SMALLEST] = node++;
        pqdownheap(s, tree, SMALLEST);

    } while (s.heap_len >= 2);

    s.heap[--(s.heap_max)] = s.heap[SMALLEST];

    /* At this point, the fields freq and dad are set. We can now
     * generate the bit lengths.
     */
    gen_bitlen(s, desc);

    /* The field len is now set, we can generate the bit codes */
    gen_codes (tree, max_code, s.bl_count);
}

/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
function scan_tree (s, tree, max_code)
{
    var n;                     /* iterates over all tree elements */
    var prevlen = -1;          /* last emitted length */
    var curlen;                /* length of current code */
    var nextlen = tree[0].dl;  /* length of next code */
    var count = 0;             /* repeat count of the current code */
    var max_count = 7;         /* max repeat count */
    var min_count = 4;         /* min repeat count */

    if (nextlen == 0) { max_count = 138; min_count = 3; }
    tree[max_code+1].dl = 0xffff; /* guard */

    for (n = 0; n <= max_code; n++) {
        curlen = nextlen; nextlen = tree[n+1].dl;
        if (++count < max_count && curlen == nextlen) {
            continue;
        } else if (count < min_count) {
            s.bl_tree[curlen].fc += count;
        } else if (curlen != 0) {
            if (curlen != prevlen) s.bl_tree[curlen].fc++;
            s.bl_tree[REP_3_6].fc++;
        } else if (count <= 10) {
            s.bl_tree[REPZ_3_10].fc++;
        } else {
            s.bl_tree[REPZ_11_138].fc++;
        }
        count = 0; prevlen = curlen;
        if (nextlen == 0) {
            max_count = 138; min_count = 3;
        } else if (curlen == nextlen) {
            max_count = 6; min_count = 3;
        } else {
            max_count = 7; min_count = 4;
        }
    }
}

/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
function send_tree (s, tree, max_code)
{
    var n;                     /* iterates over all tree elements */
    var prevlen = -1;          /* last emitted length */
    var curlen;                /* length of current code */
    var nextlen = tree[0].dl;  /* length of next code */
    var count = 0;             /* repeat count of the current code */
    var max_count = 7;         /* max repeat count */
    var min_count = 4;         /* min repeat count */

    /* tree[max_code+1].Len = -1; */  /* guard already set */
    if (nextlen == 0) { max_count = 138; min_count = 3; }

    for (n = 0; n <= max_code; n++) {
        curlen = nextlen; nextlen = tree[n+1].dl;
        if (++count < max_count && curlen == nextlen) {
            continue;
        } else if (count < min_count) {
            do { send_code(s, curlen, s.bl_tree); } while (--count != 0);

        } else if (curlen != 0) {
            if (curlen != prevlen) {
                send_code(s, curlen, s.bl_tree); count--;
            }
            //Assert(count >= 3 && count <= 6, " 3_6?");
            send_code(s, REP_3_6, s.bl_tree); send_bits(s, count-3, 2);

        } else if (count <= 10) {
            send_code(s, REPZ_3_10, s.bl_tree); send_bits(s, count-3, 3);

        } else {
            send_code(s, REPZ_11_138, s.bl_tree); send_bits(s, count-11, 7);
        }
        count = 0; prevlen = curlen;
        if (nextlen == 0) {
            max_count = 138; min_count = 3;
        } else if (curlen == nextlen) {
            max_count = 6; min_count = 3;
        } else {
            max_count = 7; min_count = 4;
        }
    }
}

/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
function build_bl_tree(s)
{
    var max_blindex;  /* index of last bit length code of non zero freq */

    /* Determine the bit length frequencies for literal and distance trees */
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

    /* Build the bit length tree: */
    build_tree(s, s.bl_desc);
    /* opt_len now includes the length of the tree representations, except
     * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
     */

    /* Determine the number of bit length codes to send. The pkzip format
     * requires that at least 4 bit length codes be sent. (appnote.txt says
     * 3 but the actual value used is 4.)
     */
    for (max_blindex = BL_CODES-1; max_blindex >= 3; max_blindex--) {
        if (s.bl_tree[bl_order[max_blindex]].dl != 0) break;
    }
    /* Update opt_len to include the bit length tree and counts */
    s.opt_len += 3*(max_blindex+1) + 5+5+4;
    //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
    //        s->opt_len, s->static_len));

    return max_blindex;
}

/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
function send_all_trees(s, lcodes, dcodes, blcodes)
{
    var rank;                    /* index in bl_order */

    //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
    //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
    //        "too many codes");
    //Tracev((stderr, "\nbl counts: "));
    send_bits(s, lcodes-257, 5); /* not +255 as stated in appnote.txt */
    send_bits(s, dcodes-1,   5);
    send_bits(s, blcodes-4,  4); /* not -3 as stated in appnote.txt */
    for (rank = 0; rank < blcodes; rank++) {
        //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
        send_bits(s, s.bl_tree[bl_order[rank]].dl, 3);
    }
    //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_ltree, lcodes-1); /* literal tree */
    //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_dtree, dcodes-1); /* distance tree */
    //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
}

/* ===========================================================================
 * Send a stored block
 */
function _tr_stored_block(s, buf, stored_len, last)
{
    send_bits(s, (STORED_BLOCK<<1)+last, 3);    /* send block type */
//#ifdef DEBUG
//    s->compressed_len = (s->compressed_len + 3 + 7) & (ulg)~7L;
//    s->compressed_len += (stored_len + 4) << 3;
//#endif
    copy_block(s, buf, stored_len, 1); /* with header */
}

/* ===========================================================================
 * Flush the bits in the bit buffer to pending output (leaves at most 7 bits)
 */
function _tr_flush_bits(s)
{
    bi_flush(s);
}

/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
function _tr_align(s)
{
    send_bits(s, STATIC_TREES<<1, 3);
    send_code(s, END_BLOCK, static_ltree);
//#ifdef DEBUG
//    s->compressed_len += 10L; /* 3 for block type, 7 for EOB */
//#endif
    bi_flush(s);
}

/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
function _tr_flush_block(s, buf, stored_len, last)
{
    var opt_lenb, static_lenb; /* opt_len and static_len in bytes */
    var max_blindex = 0;  /* index of last bit length code of non zero freq */

    /* Build the Huffman trees unless a stored block is forced */
    if (s.level > 0) {

        /* Check if the file is binary or text */
        if (s.strm.data_type == ZLIB.Z_UNKNOWN)
            s.strm.data_type = detect_data_type(s);

        /* Construct the literal and distance trees */
        build_tree(s, s.l_desc);
        //Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
        //        s->static_len));

        build_tree(s, s.d_desc);
        //Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
        //        s->static_len));
        /* At this point, opt_len and static_len are the total bit lengths of
         * the compressed block data, excluding the tree representations.
         */

        /* Build the bit length tree for the above two trees, and get the index
         * in bl_order of the last bit length code to send.
         */
        max_blindex = build_bl_tree(s);

        /* Determine the best encoding. Compute the block lengths in bytes. */
        opt_lenb = (s.opt_len+3+7)>>3;
        static_lenb = (s.static_len+3+7)>>3;

        //Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
        //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
        //        s->last_lit));

        if (static_lenb <= opt_lenb) opt_lenb = static_lenb;

    } else {
        //Assert(buf != (char*)0, "lost buf");
        opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
    }

//#ifdef FORCE_STORED
//    if (buf != (char*)0) { /* force stored block */
//#else
    if (stored_len+4 <= opt_lenb && buf !== null) {
                       /* 4: two words for the lengths */
//#endif
        /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
         * Otherwise we can't have processed more than WSIZE input bytes since
         * the last block flush, because compression would have been
         * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
         * transform a block into a stored block.
         */
        _tr_stored_block(s, buf, stored_len, last);

//#ifdef FORCE_STATIC
//    } else if (static_lenb >= 0) { /* force static trees */
//#else
    } else if (s.strategy == ZLIB.Z_FIXED || static_lenb == opt_lenb) {
//#endif
        send_bits(s, (STATIC_TREES<<1)+last, 3);
        compress_block(s, static_ltree, static_dtree);
//#ifdef DEBUG
//        s->compressed_len += 3 + s->static_len;
//#endif
    } else {
        send_bits(s, (DYN_TREES<<1)+last, 3);
        send_all_trees(s, s.l_desc.max_code+1, s.d_desc.max_code+1,
                       max_blindex+1);
        compress_block(s, s.dyn_ltree, s.dyn_dtree);
//#ifdef DEBUG
//        s->compressed_len += 3 + s->opt_len;
//#endif
    }
    //Assert (s->compressed_len == s->bits_sent, "bad compressed size");
    /* The above check is made mod 2^32, for files larger than 512 MB
     * and uLong implemented on 32 bits.
     */
    init_block(s);

    if (last) {
        bi_windup(s);
//#ifdef DEBUG
//        s->compressed_len += 7;  /* align on byte boundary */
//#endif
    }
    //Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
    //       s->compressed_len-7*last));
}

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
function _tr_tally (s, dist, lc)
{
    s.d_buf[s.last_lit] = dist;
    s.l_buf[s.last_lit++] = lc;
    if (dist == 0) {
        /* lc is the unmatched char */
        s.dyn_ltree[lc].fc++;
    } else {
        s.matches++;
        /* Here, lc is the match length - MIN_MATCH */
        dist--;             /* dist = match distance - 1 */
        //Assert((ush)dist < (ush)MAX_DIST(s) &&
        //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
        //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

        s.dyn_ltree[_length_code[lc]+LITERALS+1].fc++;
        s.dyn_dtree[d_code(dist)].fc++;
    }

//#ifdef TRUNCATE_BLOCK
//    /* Try to guess if it is profitable to stop the current block here */
//    if ((s->last_lit & 0x1fff) == 0 && s->level > 2) {
//        /* Compute an upper bound for the compressed length */
//        ulg out_length = (ulg)s->last_lit*8L;
//        ulg in_length = (ulg)((long)s->strstart - s->block_start);
//        int dcode;
//        for (dcode = 0; dcode < D_CODES; dcode++) {
//            out_length += (ulg)s->dyn_dtree[dcode].Freq *
//                (5L+extra_dbits[dcode]);
//        }
//        out_length >>= 3;
//        Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
//               s->last_lit, in_length, out_length,
//               100L - out_length*100L/in_length));
//        if (s->matches < s->last_lit/2 && out_length < in_length/2) return 1;
//    }
//#endif
    return (s.last_lit == s.lit_bufsize-1);
    /* We avoid equality with lit_bufsize because of wraparound at 64K
     * on 16 bit machines and because stored blocks are restricted to
     * 64K-1 bytes.
     */
}

function _tr_tally_lit(s, c)
{
    return _tr_tally(s, 0, c);
}

function _tr_tally_dist(s, distance, length)
{
    return _tr_tally(s, distance, length);
}

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
function compress_block(s, ltree, dtree)
{
    var dist;   /* distance of matched string */
    var lc;     /* match length or unmatched char (if dist == 0) */
    var lx = 0; /* running index in l_buf */
    var code;   /* the code to send */
    var extra;  /* number of extra bits to send */

    if (s.last_lit != 0) do {
        dist = s.d_buf[lx];
        lc = s.l_buf[lx++];
        if (dist == 0) {
            send_code(s, lc, ltree); /* send a literal byte */
            //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
        } else {
            /* Here, lc is the match length - MIN_MATCH */
            code = _length_code[lc];
            send_code(s, code+LITERALS+1, ltree); /* send the length code */
            extra = extra_lbits[code];
            if (extra != 0) {
                lc -= base_length[code];
                send_bits(s, lc, extra);       /* send the extra length bits */
            }
            dist--; /* dist is now the match distance - 1 */
            code = d_code(dist);
            //Assert (code < D_CODES, "bad d_code");

            send_code(s, code, dtree);       /* send the distance code */
            extra = extra_dbits[code];
            if (extra != 0) {
                dist -= base_dist[code];
                send_bits(s, dist, extra);   /* send the extra distance bits */
            }
        } /* literal or match pair ? */

        /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
        //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
        //       "pendingBuf overflow");

    } while (lx < s.last_lit);

    send_code(s, END_BLOCK, ltree);
}

/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "black list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
function detect_data_type(s)
{
    /* black_mask is the bit mask of black-listed bytes
     * set bits 0..6, 14..25, and 28..31
     * 0xf3ffc07f = binary 11110011111111111100000001111111
     */
    var black_mask = 0xf3ffc07f;
    var n;

    /* Check for non-textual ("black-listed") bytes. */
    for (n = 0; n <= 31; n++, black_mask >>= 1)
        if ((black_mask & 1) && (s.dyn_ltree[n].fc != 0))
            return ZLIB.Z_BINARY;

    /* Check for textual ("white-listed") bytes. */
    if (s.dyn_ltree[9].fc != 0 || s.dyn_ltree[10].fc != 0 ||
        s.dyn_ltree[13].fc != 0) {
        return ZLIB.Z_TEXT;
    }
    for (n = 32; n < LITERALS; n++) {
        if (s.dyn_ltree[n].fc != 0)
            return ZLIB.Z_TEXT;
    }

    /* There are no "black-listed" or "white-listed" bytes:
     * this stream either is empty or has tolerated ("gray-listed") bytes only.
     */
    return ZLIB.Z_BINARY;
}

/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
function bi_reverse(code, len)
{
    var res = 0;
    do {
        res |= code & 1;
        code >>= 1;
        res <<= 1;
    } while (--len > 0);
    return res >> 1;
}

/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
function bi_flush(s)
{
    if (s.bi_valid == 16) {
        put_short(s, s.bi_buf);
        s.bi_buf = 0;
        s.bi_valid = 0;
    } else if (s.bi_valid >= 8) {
        put_byte(s, s.bi_buf & 0xff);
        s.bi_buf >>= 8;
        s.bi_valid -= 8;
    }
}

/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
function bi_windup(s)
{
    if (s.bi_valid > 8) {
        put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
        put_byte(s, s.bi_buf);
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
//#ifdef DEBUG
//    s->bits_sent = (s->bits_sent+7) & ~7;
//#endif
}

/* ===========================================================================
 * Copy a stored block, storing first the length and its
 * one's complement if requested.
 */
function copy_block(s, buf, len, header)
{
    bi_windup(s);        /* align on byte boundary */

    if (header) {
        put_short(s, len);
        put_short(s, ~len);
//#ifdef DEBUG
//        s->bits_sent += 2*16;
//#endif
    }
//#ifdef DEBUG
//    s->bits_sent += (ulg)len<<3;
//#endif
    var window = s.window;
    while (len--) {
        put_byte(s, window[buf++]);
    }
}

// enum block_state
var need_more = 0;      /* block not completed, need more input or more output */
var block_done = 1;     /* block flush performed */
var finish_started = 2; /* finish started, need only more output at next deflate */
var finish_done = 3;    /* finish done, accept no more input or output */

var TOO_FAR = 4096;

/* rank Z_BLOCK between Z_NO_FLUSH and Z_PARTIAL_FLUSH */
function RANK(f)
{
    return (f << 1) - (f > 4 ? 9 : 0);
}

/* ===========================================================================
 * Update a hash value with the given input byte
 * IN  assertion: all calls to to UPDATE_HASH are made with consecutive
 *    input characters, so that a running hash key can be computed from the
 *    previous key instead of complete recalculation each time.
 */
function UPDATE_HASH(s,c)
{
    s.ins_h = ((s.ins_h << s.hash_shift) ^ c) & s.hash_mask;
}

/* ===========================================================================
 * Insert string str in the dictionary and set match_head to the previous head
 * of the hash chain (the most recent string with same hash key). Return
 * the previous length of the hash chain.
 * If this file is compiled with -DFASTEST, the compression level is forced
 * to 1, and no hash chains are maintained.
 * IN  assertion: all calls to to INSERT_STRING are made with consecutive
 *    input characters and the first MIN_MATCH bytes of str are valid
 *    (except for the last MIN_MATCH-1 bytes of the input file).
 */
function INSERT_STRING(s)
{
    var match_head;
    var str = s.strstart;
    UPDATE_HASH(s, s.window[str + (MIN_MATCH-1)]);
    match_head = s.prev[str & s.w_mask] = s.head[s.ins_h];
    s.head[s.ins_h] = str;
    return match_head;
}

/* ===========================================================================
 * Initialize the hash table (avoiding 64K overflow for 16 bit systems).
 * prev[] will be initialized on the fly.
 */
function CLEAR_HASH(s)
{
    //s->head[s->hash_size-1] = NIL;
    //zmemzero((Bytef *)s->head, (unsigned)(s->hash_size-1)*sizeof(*s->head));
    var i;
    var n = s.hash_size;
    var head = s.head;
    for(i = 0; i < n; i++) head[i] = 0;
}

/* ========================================================================= */
ZLIB.deflateInit = function(opts)
{
    var level      = getarg(opts, 'level',      ZLIB.Z_DEFAULT_COMPRESSION);
    var method     = getarg(opts, 'method',     ZLIB.Z_DEFLATED);
    var windowBits = getarg(opts, 'windowBits', ZLIB.MAX_WBITS);
    var memLevel   = getarg(opts, 'memLevel',   DEF_MEM_LEVEL);
    var strategy   = getarg(opts, 'strategy',   ZLIB.Z_DEFAULT_STRATEGY);
    return deflateInit2(level, method, windowBits, memLevel, strategy);
};

/* ========================================================================= */
function deflateInit2(level, method, windowBits, memLevel, strategy)
{
    var s; // deflate_state
    var wrap = 1;
    //static const char my_version[] = ZLIB_VERSION;

//    ushf *overlay;
//    /* We overlay pending_buf and d_buf+l_buf. This works since the average
//     * output size for (length,distance) codes is <= 24 bits.
//     */

    var strm = new ZLIB.z_stream();
    if (level == ZLIB.Z_DEFAULT_COMPRESSION) level = 6;

    if (windowBits < 0) { /* suppress zlib wrapper */
        wrap = 0;
        windowBits = -windowBits;
    }
    else if (windowBits > 15) {
        wrap = 2;       /* write gzip wrapper instead */
        windowBits -= 16;
    }

	if(wrap == 1 && (typeof ZLIB.adler32 === 'function')) {
		strm.checksum_function = ZLIB.adler32;
	} else if(wrap == 2 && (typeof ZLIB.crc32 === 'function')) {
		strm.checksum_function = ZLIB.crc32;
	} else {
		strm.checksum_function = checksum_none;
	}

    if (memLevel < 1 || memLevel > ZLIB.MAX_MEM_LEVEL || method != ZLIB.Z_DEFLATED ||
        windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
        strategy < 0 || strategy > ZLIB.Z_FIXED) {
        return null; // ZLIB.Z_STREAM_ERROR;
    }
    if (windowBits == 8) windowBits = 9;  /* until 256-byte window bug fixed */
    s = new deflate_state();
    strm.state = s;
    s.strm = strm;

    s.wrap = wrap;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;

    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ((s.hash_bits+MIN_MATCH-1)/MIN_MATCH) & 0xffffffff;

    s.window = new_array(s.w_size);
    s.prev   = new_array(s.w_size);
    s.head   = new_array(s.hash_size);

    s.high_water = 0;      /* nothing written to s->window yet */

    s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

    s.pending_buf = '';
    s.pending_buf_size = s.lit_bufsize * 4;

    s.d_buf = new_array(s.lit_bufsize);
    s.l_buf = new_array(s.lit_bufsize);

    s.level = level;
    s.strategy = strategy;
    s.method = method;

    ZLIB.deflateReset(strm);
    return strm;
};

/* ========================================================================= */
ZLIB.deflateResetKeep = function(strm)
{
    var s;

    if (!strm || !strm.state) {
        return ZLIB.Z_STREAM_ERROR;
    }

    strm.total_in = strm.total_out = 0;
    strm.msg = null; /* use zfree if we ever allocate msg dynamically */
    strm.data_type = ZLIB.Z_UNKNOWN;

    s = strm.state;
    s.pending_buf = '';

    if (s.wrap < 0) {
        s.wrap = -s.wrap; /* was made negative by deflate(..., Z_FINISH); */
    }
    s.status = s.wrap ? INIT_STATE : BUSY_STATE;
	strm.adler = strm.checksum_function(0, null, 0, 0);
    s.last_flush = ZLIB.Z_NO_FLUSH;

    _tr_init(s);

    return ZLIB.Z_OK;
};

/* ========================================================================= */
ZLIB.deflateReset = function(strm)
{
    var ret;

    ret = ZLIB.deflateResetKeep(strm);
    if (ret == ZLIB.Z_OK)
        lm_init(strm.state);
    return ret;
};

/* ========================================================================= */
ZLIB.deflatePending = function(strm, results)
{
    if (!strm || !strm.state) return ZLIB.Z_STREAM_ERROR;
    results.pending = strm.state.pending_buf.length;
    results.bits    = strm.state.bi_valid;
    return ZLIB.Z_OK;
};

/* ========================================================================= */
ZLIB.deflateParams = function(strm, level, strategy)
{
    var s;
    var func;
    var err = ZLIB.Z_OK;

    if (!strm || !strm.state) return ZLIB.Z_STREAM_ERROR;
    s = strm.state;

    if (level == ZLIB.Z_DEFAULT_COMPRESSION) level = 6;
    if (level < 0 || level > 9 || strategy < 0 || strategy > ZLIB.Z_FIXED) {
        return ZLIB.Z_STREAM_ERROR;
    }
    func = configuration_table[s.level].func;

    if ((strategy != s.strategy || func != configuration_table[level].func) &&
        strm.total_in != 0) {
        /* Flush the last buffer: */
        err = ZLIB.deflate(strm, ZLIB.Z_BLOCK);
    }
    if (s.level != level) {
        s.level = level;
        s.max_lazy_match   = configuration_table[level].max_lazy;
        s.good_match       = configuration_table[level].good_length;
        s.nice_match       = configuration_table[level].nice_length;
        s.max_chain_length = configuration_table[level].max_chain;
    }
    s.strategy = strategy;
    return err;
};

/* ========================================================================= */
ZLIB.deflateTune = function(strm, good_length, max_lazy, nice_length, max_chain)
{
    var s;

    if (!strm || !strm.state) return ZLIB.Z_STREAM_ERROR;
    s = strm.state;
    s.good_match = good_length;
    s.max_lazy_match = max_lazy;
    s.nice_match = nice_length;
    s.max_chain_length = max_chain;
    return ZLIB.Z_OK;
};

/* =========================================================================
 * For the default windowBits of 15 and memLevel of 8, this function returns
 * a close to exact, as well as small, upper bound on the compressed size.
 * They are coded as constants here for a reason--if the #define's are
 * changed, then this function needs to be changed as well.  The return
 * value for 15 and 8 only works for those exact settings.
 *
 * For any setting other than those defaults for windowBits and memLevel,
 * the value returned is a conservative worst case for the maximum expansion
 * resulting from using fixed blocks instead of stored blocks, which deflate
 * can emit on compressed data for some combinations of the parameters.
 *
 * This function could be more sophisticated to provide closer upper bounds for
 * every combination of windowBits and memLevel.  But even the conservative
 * upper bound of about 14% expansion does not seem onerous for output buffer
 * allocation.
 */
ZLIB.deflateBound = function(strm, sourceLen)
{
    var s;
    var complen, wraplen;
	var str;

    /* conservative upper bound for compressed data */
    complen = sourceLen +
              ((sourceLen + 7) >> 3) + ((sourceLen + 63) >> 6) + 5;

    /* if can't get parameters, return conservative bound plus zlib wrapper */
    if (!strm || !strm.state)
        return complen + 6;

    /* compute wrapper length */
    s = strm.state;
    switch (s.wrap) {
    case 0:                                 /* raw deflate */
        wraplen = 0;
        break;
    case 1:                                 /* zlib wrapper */
        wraplen = 6 + (s.strstart ? 4 : 0);
        break;
    case 2:                                 /* gzip wrapper */
        wraplen = 18;
        if (s.gzhead !== null) {          /* user-supplied gzip header */
			var len;
            if (s.gzhead.extra != null)
                wraplen += 2 + s.gzhead.extra.length;
            str = s.gzhead.name;
            if (str !== null) {
				len = 0;
                do {
                    wraplen++;
                } while (len < str.length && (str.charCodeAt(len++) & 0xff) != 0);
			}
            str = s.gzhead.comment;
            if (str !== null) {
				len = 0;
                do {
                    wraplen++;
                } while (len < str.length && (str.charCodeAt(len++) & 0xff) != 0);
			}
            if (s.gzhead.hcrc)
                wraplen += 2;
        }
        break;
    default:                                /* for compiler happiness */
        wraplen = 6;
    }

    /* if not default parameters, return conservative bound */
    if (s.w_bits != 15 || s.hash_bits != 8 + 7)
        return complen + wraplen;

    /* default settings: return tight bound for that case */
    return sourceLen + (sourceLen >> 12) + (sourceLen >> 14) +
           (sourceLen >> 25) + 13 - 6 + wraplen;
};

/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
function putShortMSB (s, b)
{
    s.pending_buf += String.fromCharCode((b >> 8) & 0xff);
    s.pending_buf += String.fromCharCode(b & 0xff);
}

/* =========================================================================
 * Flush as much pending output as possible. All deflate() output goes
 * through this function so some applications may wish to modify it
 * to avoid allocating a large strm->next_out buffer and copying into it.
 * (See also read_buf()).
 */
function flush_pending(strm)
{
    var len;
    var s = strm.state;

    _tr_flush_bits(s);
    len = s.pending_buf.length;
    if (len > strm.avail_out) len = strm.avail_out;
    if (len == 0) return;

    strm.output_data += s.pending_buf.substring(0, len);
    s.pending_buf = s.pending_buf.substring(len, s.pending_buf.length);
    strm.total_out += len;
    strm.avail_out -= len;
}

var z_errmsg =
    ['need dictionary',     /* Z_NEED_DICT       2  */
     'stream end',          /* Z_STREAM_END      1  */
     '',                    /* Z_OK              0  */
     'file error',          /* Z_ERRNO         (-1) */
     'stream error',        /* Z_STREAM_ERROR  (-2) */
     'data error',          /* Z_DATA_ERROR    (-3) */
     'insufficient memory', /* Z_MEM_ERROR     (-4) */
     'buffer error',        /* Z_BUF_ERROR     (-5) */
     'incompatible version',/* Z_VERSION_ERROR (-6) */
     ''];
function ERR_MSG(err) { return z_errmsg[ZLIB.Z_NEED_DICT-(err)]; }
function ERR_RETURN(strm,err) { strm.msg = ERR_MSG(err); return err; }

ZLIB.deflate = function(strm, flush)
{
    var old_flush; /* value of flush param for previous deflate call */
    var s;

    if (!strm || !strm.state ||
        flush > ZLIB.Z_BLOCK || flush < 0) {
        return ZLIB.Z_STREAM_ERROR;
    }
    s = strm.state;

    if (strm.output_data === null ||
        (strm.input_data === null && strm.avail_in != 0) ||
        (s.status == FINISH_STATE && flush != ZLIB.Z_FINISH)) {
        return ERR_RETURN(strm, ZLIB.Z_STREAM_ERROR);
    }
    if (strm.avail_out == 0) return ERR_RETURN(strm, ZLIB.Z_BUF_ERROR);

    s.strm = strm; /* just in case */
    old_flush = s.last_flush;
    s.last_flush = flush;

    /* Write the header */
    if (s.status == INIT_STATE) {
// #ifdef GZIP
        if (s.wrap == 2) {
            strm.adler = strm.checksum_function(0, null, 0, 0);
            put_byte(s, 31);
            put_byte(s, 139);
            put_byte(s, 8);
            if (s.gzhead === null) {
                put_byte(s, 0);
                put_byte(s, 0);
                put_byte(s, 0);
                put_byte(s, 0);
                put_byte(s, 0);
                put_byte(s, s.level == 9 ? 2 :
                            (s.strategy >= ZLIB.Z_HUFFMAN_ONLY || s.level < 2 ?
                             4 : 0));
                put_byte(s, ZLIB.OS_CODE);

                s.status = BUSY_STATE;
            }
            else {
                put_byte(s, (s.gzhead.text ? 1 : 0) +
                            (s.gzhead.hcrc ? 2 : 0) +
                            (s.gzhead.extra === null ? 0 : 4) +
                            (s.gzhead.name === null ? 0 : 8) +
                            (s.gzhead.comment === null ? 0 : 16)
                        );
                put_byte(s, s.gzhead.time & 0xff);
                put_byte(s, (s.gzhead.time >>> 8) & 0xff);
                put_byte(s, (s.gzhead.time >>> 16) & 0xff);
                put_byte(s, (s.gzhead.time >>> 24) & 0xff);
                put_byte(s, s.level == 9 ? 2 :
                            (s.strategy >= ZLIB.Z_HUFFMAN_ONLY || s.level < 2 ?
                             4 : 0));
                put_byte(s, s.gzhead.os & 0xff);
                if (s.gzhead.extra !== null) {
                    put_byte(s, s.gzhead.extra.length & 0xff);
                    put_byte(s, (s.gzhead.extra.length >>> 8) & 0xff);
                }
                if (s.gzhead.hcrc)
                    strm.adler = strm.checksum_function(strm.adler, s.pending_buf,
														s.pending);
                s.gzindex = 0;
                s.status = EXTRA_STATE;
            }
        }
        else
//#endif
        {
            var header = (ZLIB.Z_DEFLATED + ((s.w_bits-8)<<4)) << 8;
            var level_flags;

            if (s.strategy >= ZLIB.Z_HUFFMAN_ONLY || s.level < 2)
                level_flags = 0;
            else if (s.level < 6)
                level_flags = 1;
            else if (s.level == 6)
                level_flags = 2;
            else
                level_flags = 3;
            header |= (level_flags << 6);
            if (s.strstart != 0) header |= PRESET_DICT;
            header += 31 - (header % 31);

            s.status = BUSY_STATE;
            putShortMSB(s, header);

            /* Save the adler32 of the preset dictionary: */
            if (s.strstart != 0) {
                putShortMSB(s, (strm.adler >>> 16));
                putShortMSB(s, (strm.adler & 0xffff));
            }
			strm.adler = strm.checksum_function(0, null, 0, 0);
        }
    }
// #ifdef GZIP
    if (s.status == EXTRA_STATE) {
        if (s.gzhead.extra !== null) {
            var beg = s.pending_buf.length;  /* start of bytes to update crc */
			var extra_len = s.gzhead.extra.length;

            while (s.gzindex < (extra_len & 0xffff)) {
                if (s.pending_buf.length == s.pending_buf_size) {
                    if (s.gzhead.hcrc && s.pending_buf.length > beg)
                        strm.adler = strm.checksum_function(strm.adler, s.pending_buf, beg,
															s.pending_buf.length - beg);
                    flush_pending(strm);
                    beg = s.pending_buf.length;
                    if (s.pending_buf.length == s.pending_buf_size)
                        break;
                }
                put_byte(s, s.gzhead.extra.charCodeAt(s.gzindex) & 0xff);
                s.gzindex++;
            }
            if (s.gzhead.hcrc && s.pending_buf.length > beg) {
                strm.adler = strm.checksum_function(strm.adler, s.pending_buf, beg,
													s.pending_buf.length - beg);
			}
            if (s.gzindex == extra_len) {
                s.gzindex = 0;
                s.status = NAME_STATE;
            }
        }
        else
            s.status = NAME_STATE;
    }
    if (s.status == NAME_STATE) {
        if (s.gzhead.name !== null) {
            var beg = s.pending_buf.length;  /* start of bytes to update crc */
            var val;

            do {
                if (s.pending_buf.length == s.pending_buf_size) {
                    if (s.gzhead.hcrc && s.pending_buf.length > beg)
                        strm.adler = strm.checksum_function(strm.adler, s.pending_buf + beg,
															s.pending_buf.length - beg);
                    flush_pending(strm);
                    beg = s.pending_buf.length;
                    if (s.pending_buf.length == s.pending_buf_size) {
                        val = 1;
                        break;
                    }
                }
				if( s.gzindex == s.gzhead.name.length) {
					val = 0;
				} else {
					val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
				}
                put_byte(s, val);
            } while (val != 0);
            if (s.gzhead.hcrc && s.pending_buf.length > beg)
                strm.adler = strm.checksum_function(strm.adler, s.pending_buf, beg,
													 s.pending_buf.length - beg);
            if (val == 0) {
                s.gzindex = 0;
                s.status = COMMENT_STATE;
            }
        }
        else
            s.status = COMMENT_STATE;
    }
    if (s.status == COMMENT_STATE) {
        if (s.gzhead.comment !== null) {
            var beg = s.pending_buf.length;  /* start of bytes to update crc */
            var val;

            do {
                if (s.pending_buf.length == s.pending_buf_size) {
                    if (s.gzhead.hcrc && s.pending_buf.length > beg)
                        strm.adler = strm.checksum_function(strm.adler, s.pending_buf, beg,
                                            s.pending_buf.length - beg);
                    flush_pending(strm);
                    beg = s.pending_buf.length;
                    if (s.pending_buf.length == s.pending_buf_size) {
                        val = 1;
                        break;
                    }
                }
				if(s.gzhead.comment.length == s.gzindex) {
					val = 0;
				} else {
					val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
				}
                put_byte(s, val);
            } while (val != 0);
            if (s.gzhead.hcrc && s.pending_buf.length > beg)
                strm.adler = strm.checksum_function(strm.adler, s.pending_buf, beg,
                                    s.pending_buf.length - beg);
            if (val == 0)
                s.status = HCRC_STATE;
        }
        else
            s.status = HCRC_STATE;
    }
    if (s.status == HCRC_STATE) {
        if (s.gzhead.hcrc) {
            if (s.pending_buf.length + 2 > s.pending_buf_size)
                flush_pending(strm);
            if (s.pending_buf.length + 2 <= s.pending_buf_size) {
                put_byte(s, strm.adler & 0xff);
                put_byte(s, (strm.adler >>> 8) & 0xff);
                strm.adler = strm.checksum_function(0, null, 0, 0);
                s.status = BUSY_STATE;
            }
        }
        else
            s.status = BUSY_STATE;
    }
//#endif

    /* Flush as much pending output as possible */
    if (s.pending_buf.length != 0) {
        flush_pending(strm);
        if (strm.avail_out == 0) {
            /* Since avail_out is 0, deflate will be called again with
             * more output space, but possibly with both pending and
             * avail_in equal to zero. There won't be anything to do,
             * but this is not an error situation so make sure we
             * return OK instead of BUF_ERROR at next call of deflate:
             */
            s.last_flush = -1;
            return ZLIB.Z_OK;
        }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
    } else if (strm.avail_in == 0 && RANK(flush) <= RANK(old_flush) &&
               flush != ZLIB.Z_FINISH) {
        return ERR_RETURN(strm, ZLIB.Z_BUF_ERROR);
    }

    /* User must not provide more input after the first FINISH: */
    if (s.status == FINISH_STATE && strm.avail_in != 0) {
        return ERR_RETURN(strm, ZLIB.Z_BUF_ERROR);
    }

    /* Start a new block or continue the current one.
     */
    if (strm.avail_in != 0 || s.lookahead != 0 ||
        (flush != ZLIB.Z_NO_FLUSH && s.status != FINISH_STATE)) {
        var bstate;

        bstate = s.strategy == ZLIB.Z_HUFFMAN_ONLY ? deflate_huff(s, flush) :
                    (s.strategy == ZLIB.Z_RLE ? deflate_rle(s, flush) :
                        configuration_table[s.level].func(s, flush));

        if (bstate == finish_started || bstate == finish_done) {
            s.status = FINISH_STATE;
        }
        if (bstate == need_more || bstate == finish_started) {
            if (strm.avail_out == 0) {
                s.last_flush = -1; /* avoid BUF_ERROR next call, see above */
            }
            return ZLIB.Z_OK;
            /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
             * of deflate should use the same flush parameter to make sure
             * that the flush is complete. So we don't have to output an
             * empty block here, this will be done at next call. This also
             * ensures that for a very small output buffer, we emit at most
             * one empty block.
             */
        }
        if (bstate == block_done) {
            if (flush == ZLIB.Z_PARTIAL_FLUSH) {
                _tr_align(s);
            } else if (flush != ZLIB.Z_BLOCK) { /* FULL_FLUSH or SYNC_FLUSH */
                _tr_stored_block(s, null, 0, 0);
                /* For a full flush, this empty block will be recognized
                 * as a special marker by inflate_sync().
                 */
                if (flush == ZLIB.Z_FULL_FLUSH) {
                    CLEAR_HASH(s);             /* forget history */
                    if (s.lookahead == 0) {
                        s.strstart = 0;
                        s.block_start = 0;
                        s.insert = 0;
                    }
                }
            }
            flush_pending(strm);
            if (strm.avail_out == 0) {
              s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
              return ZLIB.Z_OK;
            }
        }
    }
    //Assert(strm->avail_out > 0, "bug2");

    if (flush != ZLIB.Z_FINISH) return ZLIB.Z_OK;
    if (s.wrap <= 0) return ZLIB.Z_STREAM_END;

    /* Write the trailer */
    if (s.wrap == 2) {
        put_byte(s, strm.adler & 0xff);
        put_byte(s, (strm.adler >>> 8) & 0xff);
        put_byte(s, (strm.adler >>> 16) & 0xff);
        put_byte(s, (strm.adler >>> 24) & 0xff);
        put_byte(s, strm.total_in & 0xff);
        put_byte(s, (strm.total_in >>> 8) & 0xff);
        put_byte(s, (strm.total_in >>> 16) & 0xff);
        put_byte(s, (strm.total_in >>> 24) & 0xff);
    }
    else
    {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 0xffff);
    }
    flush_pending(strm);
    /* If avail_out is zero, the application will call deflate again
     * to flush the rest.
     */
    if (s.wrap > 0) s.wrap = -s.wrap; /* write the trailer only once! */
    return s.pending_buf.length != 0 ? ZLIB.Z_OK : ZLIB.Z_STREAM_END;
};

/* ========================================================================= */
ZLIB.deflateEnd = function(strm)
{
    var status;

    if (!strm || !strm.state) return ZLIB.Z_STREAM_ERROR;

    status = strm.state.status;
    if (status != INIT_STATE &&
        status != EXTRA_STATE &&
        status != NAME_STATE &&
        status != COMMENT_STATE &&
        status != HCRC_STATE &&
        status != BUSY_STATE &&
        status != FINISH_STATE) {
      return ZLIB.Z_STREAM_ERROR;
    }

    /* Deallocate in reverse order of allocations: */
    strm.state.pending_buf = null;
    strm.state.head = null;
    strm.state.prev = null;
    strm.state.window = null;

    strm.state = null;

    return status == BUSY_STATE ? ZLIB.Z_DATA_ERROR : ZLIB.Z_OK;
};

/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm.input_data buffer and copying from it.
 * (See also flush_pending()).
 */
function read_buf(strm, buf, offset, size)
{
    var len = strm.avail_in;

    if (len > size) len = size;
    if (len == 0) return 0;

    strm.avail_in  -= len;

    var i;
    var src_i = strm.next_in;
    for(i = 0; i < len; i++)
        buf[offset + i] = strm.input_data.charCodeAt(src_i + i) & 0xff;
    if(strm.state.wrap) {
        strm.adler = strm.checksum_function(strm.adler, buf, offset, len);
    }
    strm.next_in += len;
    strm.total_in += len;

    return len;
}

/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
function lm_init (s)
{
    s.window_size = 2*s.w_size;

    CLEAR_HASH(s);

    /* Set the default configuration parameters:
     */
    s.max_lazy_match   = configuration_table[s.level].max_lazy;
    s.good_match       = configuration_table[s.level].good_length;
    s.nice_match       = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;

    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH-1;
    s.match_available = 0;
    s.ins_h = 0;
//#ifndef FASTEST
//#ifdef ASMV
//    match_init(); /* initialize the asm code */
//#endif
//#endif
}

/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
function longest_match(s, cur_match)
{
    var window = s.window;
    var chain_length = s.max_chain_length;/* max hash chain length */

    // zlib.js: scan -> window[scan], match -> window[match]
    var scan = s.strstart; /* current string */
    var match;             /* matched string */

    var len;                           /* length of current match */
    var best_len = s.prev_length;              /* best match length so far */
    var nice_match = s.nice_match;             /* stop if match long enough */
    var limit = s.strstart > MAX_DIST(s) ?
        s.strstart - MAX_DIST(s) : 0;
    /* Stop when cur_match becomes <= limit. To simplify the code,
     * we prevent matches with the string of window index 0.
     */
    var prev = s.prev;
    var wmask = s.w_mask;

    // zlib.js: strend -> window[strend]
    var strend = s.strstart + MAX_MATCH;
    var scan_end1  = window[scan+best_len-1];
    var scan_end   = window[scan+best_len];

    /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
     * It is easy to get rid of this optimization if necessary.
     */
    //Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

    /* Do not waste too much time if we already have a good match: */
    if (s.prev_length >= s.good_match) {
        chain_length >>= 2;
    }
    /* Do not look for matches beyond the end of the input. This is necessary
     * to make deflate deterministic.
     */
    if (nice_match > s.lookahead) nice_match = s.lookahead;

    //Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

    do {
        //Assert(cur_match < s->strstart, "no future");
        match = cur_match;

        /* Skip to next match if the match length cannot increase
         * or if the match length is less than 2.  Note that the checks below
         * for insufficient lookahead only occur occasionally for performance
         * reasons.  Therefore uninitialized memory will be accessed, and
         * conditional jumps will be made that depend on those values.
         * However the length of the match is limited to the lookahead, so
         * the output of deflate is not affected by the uninitialized values.
         */
        if (window[match+best_len]   != scan_end  ||
            window[match+best_len-1] != scan_end1 ||
            window[match]            != window[scan]     ||
            window[++match]          != window[scan+1])      continue;

        /* The check at best_len-1 can be removed because it will be made
         * again later. (This heuristic is not always a win.)
         * It is not necessary to compare scan[2] and match[2] since they
         * are always equal when the other bytes match, given that
         * the hash keys are equal and that HASH_BITS >= 8.
         */
        scan += 2, match++;
        //Assert(*scan == *match, "match[2]?");

        /* We check for insufficient lookahead only every 8th comparison;
         * the 256th check will be made at strstart+258.
         */
        do {
        } while (window[++scan] == window[++match] && window[++scan] == window[++match] &&
                 window[++scan] == window[++match] && window[++scan] == window[++match] &&
                 window[++scan] == window[++match] && window[++scan] == window[++match] &&
                 window[++scan] == window[++match] && window[++scan] == window[++match] &&
                 scan < strend);

        //Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

        len = MAX_MATCH - (strend - scan);
        scan = strend - MAX_MATCH;

        if (len > best_len) {
            s.match_start = cur_match;
            best_len = len;
            if (len >= nice_match) break;
            scan_end1  = window[scan+best_len-1];
            scan_end   = window[scan+best_len];
        }
    } while ((cur_match = prev[cur_match & wmask]) > limit &&
             --chain_length != 0);

    if (best_len <= s.lookahead) return best_len;
    return s.lookahead;
}

function check_match(s, start, match, length) {}

/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
function fill_window(s)
{
    var n, m, i;
    var p, ary; // Posf *
    var more;    /* Amount of free space at the end of the window. */
    var wsize = s.w_size;

    //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

    do {
        more = (s.window_size - s.lookahead - s.strstart);

        /* Deal with !@#$% 64K limit: */
//        if (sizeof(int) <= 2) {
//            if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
//                more = wsize;
//
//            } else if (more == (unsigned)(-1)) {
//                /* Very unlikely, but possible on 16 bit machine if
//                 * strstart == 0 && lookahead == 1 (input done a byte at time)
//                 */
//                more--;
//            }
//        }

        /* If the window is almost full and there is insufficient lookahead,
         * move the upper half to the lower one to make room in the upper half.
         */
        if (s.strstart >= wsize+MAX_DIST(s)) {

            //zmemcpy(s->window, s->window+wsize, (unsigned)wsize);
            for(i = 0; i < wsize; i++) s.window[i] = s.window[wsize + i];
            s.match_start -= wsize;
            s.strstart    -= wsize; /* we now have strstart >= MAX_DIST */
            s.block_start -= wsize;

            /* Slide the hash table (could be avoided with 32 bit values
               at the expense of memory usage). We slide even when level == 0
               to keep the hash table consistent if we switch back to level > 0
               later. (Using level 0 permanently is not an optimal usage of
               zlib, so we don't care about this pathological case.)
             */
            n = s.hash_size;
            // p = &s->head[n];
            ary = s.head;
            p = n;
            do {
                m = ary[--p];
                ary[p] = (m >= wsize ? m-wsize : 0);
            } while (--n);

            n = wsize;
//#ifndef FASTEST
            //p = &s->prev[n];
            ary = s.prev;
            p = n;
            do {
                m = ary[--p];
                ary[p] = (m >= wsize ? m-wsize : 0);
                /* If n is not on any hash chain, prev[n] is garbage but
                 * its value will never be used.
                 */
            } while (--n);
//#endif
            more += wsize;
        }
        if (s.strm.avail_in == 0) break;

        /* If there was no sliding:
         *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
         *    more == window_size - lookahead - strstart
         * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
         * => more >= window_size - 2*WSIZE + 2
         * In the BIG_MEM or MMAP case (not yet supported),
         *   window_size == input_size + MIN_LOOKAHEAD  &&
         *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
         * Otherwise, window_size == 2*WSIZE so more >= 2.
         * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
         */
        //Assert(more >= 2, "more < 2");

        n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
        s.lookahead += n;

        /* Initialize the hash value now that we have some input: */
        if (s.lookahead + s.insert >= MIN_MATCH) {
            var str = s.strstart - s.insert;
            s.ins_h = s.window[str];
            UPDATE_HASH(s, s.window[str + 1]);
//#if MIN_MATCH != 3
//            Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
            while (s.insert) {
                UPDATE_HASH(s, s.window[str + MIN_MATCH-1]);
//#ifndef FASTEST
                s.prev[str & s.w_mask] = s.head[s.ins_h];
//#endif
                s.head[s.ins_h] = str;
                str++;
                s.insert--;
                if (s.lookahead + s.insert < MIN_MATCH)
                    break;
            }
        }
        /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
         * but this is not important since only literal bytes will be emitted.
         */

    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in != 0);

    /* If the WIN_INIT bytes after the end of the current data have never been
     * written, then zero those bytes in order to avoid memory check reports of
     * the use of uninitialized (or uninitialised as Julian writes) bytes by
     * the longest match routines.  Update the high water mark for the next
     * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
     * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
     */
    if (s.high_water < s.window_size) {
        var curr = s.strstart + s.lookahead;
        var init;

        if (s.high_water < curr) {
            /* Previous high water mark below current data -- zero WIN_INIT
             * bytes or up to end of window, whichever is less.
             */
            init = s.window_size - curr;
            if (init > WIN_INIT)
                init = WIN_INIT;
            //zmemzero(s->window + curr, (unsigned)init);
            for(i = 0; i < init; i++) s.window[i + curr] = 0;
            s.high_water = curr + init;
        }
        else if (s.high_water < curr + WIN_INIT) {
            /* High water mark at or above current data, but below current data
             * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
             * to end of window, whichever is less.
             */
            init = curr + WIN_INIT - s.high_water;
            if (init > s.window_size - s.high_water)
                init = s.window_size - s.high_water;
            //zmemzero(s->window + s->high_water, (unsigned)init);
            for(i = 0; i < init; i++) s.window[s.high_water + i] = 0;
            s.high_water += init;
        }
    }

//    Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
//           "not enough room for search");
}

/* ===========================================================================
 * Flush the current block, with given end-of-file flag.
 * IN assertion: strstart is set to the end of the current match.
 */
function FLUSH_BLOCK_ONLY(s, last)
{
    _tr_flush_block(s,
                    (s.block_start >= 0 ? s.block_start : null ),
                    s.strstart - s.block_start,
                    last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
    //Tracev((stderr,"[FLUSH]"));
}

/* Same but force premature exit if necessary. */
//function FLUSH_BLOCK(s, last)
//{
//  FLUSH_BLOCK_ONLY(s, last); if (s.strm.avail_out == 0) return last ? finish_started : need_more;
//}

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 * This function does not insert new strings in the dictionary since
 * uncompressible data is probably not useful. This function is used
 * only for the level=0 compression option.
 * NOTE: this function should be optimized to avoid extra copying from
 * window to pending_buf.
 */
function deflate_stored(s, flush)
{
    /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
     * to pending_buf_size, and each stored block has a 5 byte header:
     */
    var max_block_size = 0xffff;
    var max_start;

    if (max_block_size > s.pending_buf_size - 5) {
        max_block_size = s.pending_buf_size - 5;
    }

    /* Copy as much as possible from input to output: */
    for (;;) {
        /* Fill the window as much as possible: */
        if (s.lookahead <= 1) {

            //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
            //       s->block_start >= (long)s->w_size, "slide too late");

            fill_window(s);
            if (s.lookahead == 0 && flush == ZLIB.Z_NO_FLUSH) return need_more;

            if (s.lookahead == 0) break; /* flush the current block */
        }
        //Assert(s->block_start >= 0L, "block gone");

        s.strstart += s.lookahead;
        s.lookahead = 0;

        /* Emit a stored block if pending_buf will be full: */
        max_start = s.block_start + max_block_size;
        if (s.strstart == 0 || s.strstart >= max_start) {
            /* strstart == 0 is possible when wraparound on 16-bit machine */
            s.lookahead = (s.strstart - max_start);
            s.strstart = max_start;
            //FLUSH_BLOCK(s, 0);
            FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
        }
        /* Flush if we may have to slide, otherwise block_start may become
         * negative and the data will be gone:
         */
        if (s.strstart - s.block_start >= MAX_DIST(s)) {
            FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
        }
    }
    s.insert = 0;
    if (flush == ZLIB.Z_FINISH) {
        FLUSH_BLOCK_ONLY(s, 1); if (s.strm.avail_out == 0) return 1 ? finish_started : need_more;
        return finish_done;
    }
    if (s.strstart > s.block_start) {
        FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
    }
    return block_done;
}

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
function deflate_fast(s, flush)
{
    var hash_head;       /* head of the hash chain */
    var bflush;           /* set if current block must be flushed */

    for (;;) {
        /* Make sure that we always have enough lookahead, except
         * at the end of the input file. We need MAX_MATCH bytes
         * for the next match, plus MIN_MATCH bytes to insert the
         * string following the next match.
         */
        if (s.lookahead < MIN_LOOKAHEAD) {
            fill_window(s);
            if (s.lookahead < MIN_LOOKAHEAD && flush == ZLIB.Z_NO_FLUSH) {
                return need_more;
            }
            if (s.lookahead == 0) break; /* flush the current block */
        }

        /* Insert the string window[strstart .. strstart+2] in the
         * dictionary, and set hash_head to the head of the hash chain:
         */
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) {
            hash_head = INSERT_STRING(s);
        }

        /* Find the longest match, discarding those <= prev_length.
         * At this point we have always match_length < MIN_MATCH
         */
        if (hash_head != 0 && s.strstart - hash_head <= MAX_DIST(s)) {
            /* To simplify the code, we prevent matches with the string
             * of window index 0 (in particular we have to avoid a match
             * of the string with itself at the start of the input file).
             */
            s.match_length = longest_match (s, hash_head);
            /* longest_match() sets match_start */
        }
        if (s.match_length >= MIN_MATCH) {
            check_match(s, s.strstart, s.match_start, s.match_length);

            bflush = _tr_tally_dist(s, s.strstart - s.match_start,
                           s.match_length - MIN_MATCH);

            s.lookahead -= s.match_length;

            /* Insert new strings in the hash table only if the match length
             * is not too large. This saves time but degrades compression.
             */
//#ifndef FASTEST
            if (s.match_length <= s.max_insert_length &&
                s.lookahead >= MIN_MATCH) {
                s.match_length--; /* string at strstart already in table */
                do {
                    s.strstart++;
                    hash_head = INSERT_STRING(s);
                    /* strstart never exceeds WSIZE-MAX_MATCH, so there are
                     * always MIN_MATCH bytes ahead.
                     */
                } while (--s.match_length != 0);
                s.strstart++;
            } else
//#endif
            {
                s.strstart += s.match_length;
                s.match_length = 0;
                s.ins_h = s.window[s.strstart];
                UPDATE_HASH(s, s.window[s.strstart+1]);
//#if MIN_MATCH != 3
//                Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
                /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
                 * matter since it will be recomputed at next deflate call.
                 */
            }
        } else {
            /* No match, output a literal byte */
            //Tracevv((stderr,"%c", s->window[s->strstart]));
            bflush = _tr_tally_lit (s, s.window[s.strstart]);
            s.lookahead--;
            s.strstart++;
        }
        if (bflush) {
            FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
        }
    }
    s.insert = s.strstart < MIN_MATCH-1 ? s.strstart : MIN_MATCH-1;
    if (flush == ZLIB.Z_FINISH) {
        FLUSH_BLOCK_ONLY(s, 1); if (s.strm.avail_out == 0) return 1 ? finish_started : need_more;
        return finish_done;
    }
    if (s.last_lit) {
        FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
    }
    return block_done;
}

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
function deflate_slow(s, flush)
{
    var hash_head;          /* head of hash chain */
    var bflush;              /* set if current block must be flushed */

    /* Process the input block. */
    for (;;) {
        /* Make sure that we always have enough lookahead, except
         * at the end of the input file. We need MAX_MATCH bytes
         * for the next match, plus MIN_MATCH bytes to insert the
         * string following the next match.
         */
        if (s.lookahead < MIN_LOOKAHEAD) {
            fill_window(s);
            if (s.lookahead < MIN_LOOKAHEAD && flush == ZLIB.Z_NO_FLUSH) {
                return need_more;
            }
            if (s.lookahead == 0) break; /* flush the current block */
        }

        /* Insert the string window[strstart .. strstart+2] in the
         * dictionary, and set hash_head to the head of the hash chain:
         */
        hash_head = 0;
        if (s.lookahead >= MIN_MATCH) {
            hash_head = INSERT_STRING(s);
        }

        /* Find the longest match, discarding those <= prev_length.
         */
        s.prev_length = s.match_length; s.prev_match = s.match_start;
        s.match_length = MIN_MATCH-1;

        if (hash_head != 0 && s.prev_length < s.max_lazy_match &&
            s.strstart - hash_head <= MAX_DIST(s)) {
            /* To simplify the code, we prevent matches with the string
             * of window index 0 (in particular we have to avoid a match
             * of the string with itself at the start of the input file).
             */
            s.match_length = longest_match (s, hash_head);
            /* longest_match() sets match_start */

            if (s.match_length <= 5 && (s.strategy == ZLIB.Z_FILTERED ||
//#if TOO_FAR <= 32767
                                        (s.match_length == MIN_MATCH &&
                                         s.strstart - s.match_start > TOO_FAR)
//#endif
                    )) {

                /* If prev_match is also MIN_MATCH, match_start is garbage
                 * but we will ignore the current match anyway.
                 */
                s.match_length = MIN_MATCH-1;
            }
        }
        /* If there was a match at the previous step and the current
         * match is not better, output the previous match:
         */
        if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
            var max_insert = s.strstart + s.lookahead - MIN_MATCH;
            /* Do not insert strings in hash table beyond this. */

            check_match(s, s.strstart-1, s.prev_match, s.prev_length);

            bflush = _tr_tally_dist(s, s.strstart -1 - s.prev_match,
                           s.prev_length - MIN_MATCH);

            /* Insert in hash table all strings up to the end of the match.
             * strstart-1 and strstart are already inserted. If there is not
             * enough lookahead, the last two strings are not inserted in
             * the hash table.
             */
            s.lookahead -= s.prev_length-1;
            s.prev_length -= 2;
            do {
                if (++s.strstart <= max_insert) {
                    hash_head = INSERT_STRING(s);
                }
            } while (--s.prev_length != 0);
            s.match_available = 0;
            s.match_length = MIN_MATCH-1;
            s.strstart++;

            if (bflush) {
                FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
            }

        } else if (s.match_available) {
            /* If there was no match at the previous position, output a
             * single literal. If there was a match but the current match
             * is longer, truncate the previous match to a single literal.
             */
            //Tracevv((stderr,"%c", s->window[s->strstart-1]));
            bflush = _tr_tally_lit(s, s.window[s.strstart-1]);
            if (bflush) {
                FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
            }
            s.strstart++;
            s.lookahead--;
            if (s.strm.avail_out == 0) return need_more;
        } else {
            /* There is no previous match to compare with, wait for
             * the next step to decide.
             */
            s.match_available = 1;
            s.strstart++;
            s.lookahead--;
        }
    }
    //Assert (flush != Z_NO_FLUSH, "no flush?");
    if (s.match_available) {
        //Tracevv((stderr,"%c", s->window[s->strstart-1]));
        bflush = _tr_tally_lit(s, s.window[s.strstart-1]);
        s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH-1 ? s.strstart : MIN_MATCH-1;
    if (flush == ZLIB.Z_FINISH) {
        FLUSH_BLOCK_ONLY(s, 1); if (s.strm.avail_out == 0) return 1 ? finish_started : need_more;
        return finish_done;
    }
    if (s.last_lit) {
        FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
    }
    return block_done;
}

/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
function deflate_rle(s, flush)
{
    var bflush;             /* set if current block must be flushed */
    var prev;              /* byte at distance one to match */
    // window[scan], window[strend]
    var scan, strend;   /* scan goes up to strend for length of run */
    var window = s.window;

    for (;;) {
        /* Make sure that we always have enough lookahead, except
         * at the end of the input file. We need MAX_MATCH bytes
         * for the longest run, plus one for the unrolled loop.
         */
        if (s.lookahead <= MAX_MATCH) {
            fill_window(s);
            if (s.lookahead <= MAX_MATCH && flush == ZLIB.Z_NO_FLUSH) {
                return need_more;
            }
            if (s.lookahead == 0) break; /* flush the current block */
        }

        /* See how many times the previous byte repeats */
        s.match_length = 0;
        if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
            scan = s.strstart - 1;
            prev = window[scan];
            if (prev == window[++scan] && prev == window[++scan] && prev == window[++scan]) {
                strend = s.strstart + MAX_MATCH;
                do {
                } while (prev == window[++scan] && prev == window[++scan] &&
                         prev == window[++scan] && prev == window[++scan] &&
                         prev == window[++scan] && prev == window[++scan] &&
                         prev == window[++scan] && prev == window[++scan] &&
                         scan < strend);
                s.match_length = MAX_MATCH - (strend - scan);
                if (s.match_length > s.lookahead)
                    s.match_length = s.lookahead;
            }
            //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
        }

        /* Emit match if have run of MIN_MATCH or longer, else emit literal */
        if (s.match_length >= MIN_MATCH) {
            check_match(s, s.strstart, s.strstart - 1, s.match_length);

            bflush = _tr_tally_dist(s, 1, s.match_length - MIN_MATCH);

            s.lookahead -= s.match_length;
            s.strstart += s.match_length;
            s.match_length = 0;
        } else {
            /* No match, output a literal byte */
            //Tracevv((stderr,"%c", s->window[s->strstart]));
            bflush = _tr_tally_lit (s, s.window[s.strstart]);
            s.lookahead--;
            s.strstart++;
        }
        if (bflush) {
            FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
        }
    }
    s.insert = 0;
    if (flush == ZLIB.Z_FINISH) {
        FLUSH_BLOCK_ONLY(s, 1); if (s.strm.avail_out == 0) return 1 ? finish_started : need_more;
        return finish_done;
    }
    if (s.last_lit) {
        FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
    }
    return block_done;
}

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
function deflate_huff(s, flush)
{
    var bflush;             /* set if current block must be flushed */

    for (;;) {
        /* Make sure that we have a literal to write. */
        if (s.lookahead == 0) {
            fill_window(s);
            if (s.lookahead == 0) {
                if (flush == ZLIB.Z_NO_FLUSH)
                    return need_more;
                break;      /* flush the current block */
            }
        }

        /* Output a literal byte */
        s.match_length = 0;
        //Tracevv((stderr,"%c", s->window[s->strstart]));
        bflush = _tr_tally_lit (s, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
        if (bflush) {
            FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
        }
    }
    s.insert = 0;
    if (flush == ZLIB.Z_FINISH) {
        FLUSH_BLOCK_ONLY(s, 1); if (s.strm.avail_out == 0) return 1 ? finish_started : need_more;
        return finish_done;
    }
    if (s.last_lit) {
        FLUSH_BLOCK_ONLY(s, 0); if (s.strm.avail_out == 0) return 0 ? finish_started : need_more;
    }
    return block_done;
}

var configuration_table = [
/*      good lazy nice chain */
/* 0 */ {good_length:0,  max_lazy:  0, nice_length: 0,  max_chain:  0, func:deflate_stored},  /* store only */
/* 1 */ {good_length:4,  max_lazy:  4, nice_length: 8,  max_chain:  4, func:deflate_fast}, /* max speed, no lazy matches */
/* 2 */ {good_length:4,  max_lazy:  5, nice_length:16,  max_chain:  8, func:deflate_fast},
/* 3 */ {good_length:4,  max_lazy:  6, nice_length:32,  max_chain: 32, func:deflate_fast},

/* 4 */ {good_length:4,  max_lazy:  4, nice_length:16,  max_chain: 16, func:deflate_slow},  /* lazy matches */
/* 5 */ {good_length:8,  max_lazy: 16, nice_length:32,  max_chain: 32, func:deflate_slow},
/* 6 */ {good_length:8,  max_lazy: 16, nice_length:128, max_chain:128, func:deflate_slow},
/* 7 */ {good_length:8,  max_lazy: 32, nice_length:128, max_chain:256, func:deflate_slow},
/* 8 */ {good_length:32, max_lazy:128, nice_length:258, max_chain:1024, func:deflate_slow},
/* 9 */ {good_length:32, max_lazy:258, nice_length:258, max_chain:4096, func:deflate_slow} /* max compression */
];

/* Note: the deflate() code requires max_lazy >= MIN_MATCH and max_chain >= 4
 * For deflate_fast() (levels <= 3) good is ignored and lazy has a different
 * meaning.
 */

ZLIB.z_stream.prototype.deflate = function(input_string, opts)
{
    var flush;
    var avail_out;
    var DEFAULT_BUFFER_SIZE = 16384;

    this.input_data = input_string;
    this.next_in = getarg(opts, 'next_in', 0);
    this.avail_in = getarg(opts, 'avail_in', input_string.length - this.next_in);

    flush = getarg(opts, 'flush', ZLIB.Z_SYNC_FLUSH);
    avail_out = getarg(opts, 'avail_out', -1);

    var result = '';
    do {
        this.avail_out = (avail_out >= 0 ? avail_out : DEFAULT_BUFFER_SIZE);
        this.output_data = '';
        this.next_out = 0;
        this.error = ZLIB.deflate(this, flush);
        if(avail_out >= 0) {
            return this.output_data;
        }
        result += this.output_data;
		if(this.avail_out > 0) {
			break;
		}
    } while(this.error == ZLIB.Z_OK);

    return result;
};

ZLIB.z_stream.prototype.deflateReset = function()
{
    return ZLIB.deflateReset(this);
};

ZLIB.z_stream.prototype.deflateTune = function(good_length, max_lazy, nice_length, max_chain)
{
    return ZLIB.deflateTune(this, good_length, max_lazy, nice_length, max_chain);
};

ZLIB.z_stream.prototype.deflateBound = function(sourceLen)
{
	return ZLIB.deflateBound(this, sourceLen);
};


}());
