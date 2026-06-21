import type { Example } from "./problems";

/** Worked examples per problem id, attached to PROBLEMS at load time. */
export const EXAMPLES: Record<string, Example[]> = {
  // ---- Arrays & Hashing ----
  "contains-duplicate": [
    { input: "nums = [1,2,3,1]", output: "true", explanation: "1 appears twice." },
    { input: "nums = [1,2,3,4]", output: "false" },
  ],
  "valid-anagram": [
    { input: 's = "anagram", t = "nagaram"', output: "true" },
    { input: 's = "rat", t = "car"', output: "false" },
  ],
  "two-sum": [
    { input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] = 9." },
  ],
  "group-anagrams": [
    { input: 'strs = ["eat","tea","tan","ate","nat","bat"]', output: '[["eat","tea","ate"],["tan","nat"],["bat"]]' },
  ],
  "top-k-frequent": [
    { input: "nums = [1,1,1,2,2,3], k = 2", output: "[1,2]" },
  ],
  "product-except-self": [
    { input: "nums = [1,2,3,4]", output: "[24,12,8,6]" },
  ],
  "valid-sudoku": [
    { input: "a partially filled 9×9 board with no repeats in any row, column, or box", output: "true" },
    { input: "the same board but with two 8s in the top-left box", output: "false" },
  ],
  "encode-decode-strings": [
    { input: '["neet","code","love","you"]', output: 'decode(encode(list)) === the original list', explanation: "Round-trips through one string." },
  ],
  "longest-consecutive": [
    { input: "nums = [100,4,200,1,3,2]", output: "4", explanation: "The run 1,2,3,4 has length 4." },
  ],

  // ---- Two Pointers ----
  "valid-palindrome": [
    { input: 's = "A man, a plan, a canal: Panama"', output: "true" },
    { input: 's = "race a car"', output: "false" },
  ],
  "two-sum-ii": [
    { input: "numbers = [2,7,11,15], target = 9", output: "[1,2]", explanation: "1-based indices." },
  ],
  "three-sum": [
    { input: "nums = [-1,0,1,2,-1,-4]", output: "[[-1,-1,2],[-1,0,1]]" },
  ],
  "container-most-water": [
    { input: "height = [1,8,6,2,5,4,8,3,7]", output: "49" },
  ],
  "trapping-rain-water": [
    { input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]", output: "6" },
  ],

  // ---- Sliding Window ----
  "best-time-stock": [
    { input: "prices = [7,1,5,3,6,4]", output: "5", explanation: "Buy at 1, sell at 6." },
  ],
  "longest-substring": [
    { input: 's = "abcabcbb"', output: "3", explanation: '"abc".' },
  ],
  "longest-repeating-replacement": [
    { input: 's = "AABABBA", k = 1', output: "4" },
  ],
  "permutation-in-string": [
    { input: 's1 = "ab", s2 = "eidbaooo"', output: "true", explanation: 's2 contains "ba".' },
  ],
  "min-window-substring": [
    { input: 's = "ADOBECODEBANC", t = "ABC"', output: '"BANC"' },
  ],
  "sliding-window-maximum": [
    { input: "nums = [1,3,-1,-3,5,3,6,7], k = 3", output: "[3,3,5,5,6,7]" },
  ],

  // ---- Stack ----
  "valid-parentheses": [
    { input: 's = "()[]{}"', output: "true" },
    { input: 's = "(]"', output: "false" },
  ],
  "min-stack": [
    { input: "push(-2); push(0); push(-3); getMin()", output: "-3", explanation: "Then pop(); top() = 0; getMin() = -2." },
  ],
  "eval-rpn": [
    { input: 'tokens = ["2","1","+","3","*"]', output: "9", explanation: "(2 + 1) * 3." },
  ],
  "generate-parentheses": [
    { input: "n = 3", output: '["((()))","(()())","(())()","()(())","()()()"]' },
  ],
  "daily-temperatures": [
    { input: "temperatures = [73,74,75,71,69,72,76,73]", output: "[1,1,4,2,1,1,0,0]" },
  ],
  "car-fleet": [
    { input: "target = 12, position = [10,8,0,5,3], speed = [2,4,1,1,3]", output: "3" },
  ],
  "largest-rectangle-histogram": [
    { input: "heights = [2,1,5,6,2,3]", output: "10", explanation: "The 5 and 6 bars form a 5×2 = 10 rectangle." },
  ],

  // ---- Binary Search ----
  "binary-search": [
    { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4" },
    { input: "nums = [-1,0,3,5,9,12], target = 2", output: "-1" },
  ],
  "search-2d-matrix": [
    { input: "matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 3", output: "true" },
  ],
  "koko-bananas": [
    { input: "piles = [3,6,7,11], h = 8", output: "4" },
  ],
  "find-min-rotated": [
    { input: "nums = [3,4,5,1,2]", output: "1" },
  ],
  "search-rotated": [
    { input: "nums = [4,5,6,7,0,1,2], target = 0", output: "4" },
  ],
  "time-based-store": [
    { input: 'set("foo","bar",1); get("foo",1)', output: '"bar"', explanation: 'get("foo",3) also returns "bar" (largest timestamp ≤ query).' },
  ],
  "median-two-sorted": [
    { input: "nums1 = [1,3], nums2 = [2]", output: "2.0" },
    { input: "nums1 = [1,2], nums2 = [3,4]", output: "2.5" },
  ],

  // ---- Linked List ----
  "reverse-linked-list": [
    { input: "1 → 2 → 3 → 4 → 5", output: "5 → 4 → 3 → 2 → 1" },
  ],
  "merge-two-lists": [
    { input: "1 → 2 → 4, 1 → 3 → 4", output: "1 → 1 → 2 → 3 → 4 → 4" },
  ],
  "reorder-list": [
    { input: "1 → 2 → 3 → 4", output: "1 → 4 → 2 → 3" },
  ],
  "remove-nth-end": [
    { input: "1 → 2 → 3 → 4 → 5, n = 2", output: "1 → 2 → 3 → 5" },
  ],
  "copy-random-list": [
    { input: "a list whose nodes also point to random nodes", output: "an independent deep copy with the same value/next/random structure" },
  ],
  "add-two-numbers": [
    { input: "(2 → 4 → 3) + (5 → 6 → 4)", output: "7 → 0 → 8", explanation: "342 + 465 = 807, stored least-significant digit first." },
  ],
  "linked-list-cycle": [
    { input: "3 → 2 → 0 → -4, with -4 pointing back to 2", output: "true" },
  ],
  "find-duplicate": [
    { input: "nums = [1,3,4,2,2]", output: "2" },
  ],
  "lru-cache": [
    { input: "cap 2: put(1,1); put(2,2); get(1); put(3,3); get(2)", output: "get(1)=1, get(2)=-1", explanation: "put(3,3) evicts key 2 (least recently used)." },
  ],
  "merge-k-lists": [
    { input: "[[1,4,5],[1,3,4],[2,6]]", output: "1 → 1 → 2 → 3 → 4 → 4 → 5 → 6" },
  ],
  "reverse-k-group": [
    { input: "1 → 2 → 3 → 4 → 5, k = 2", output: "2 → 1 → 4 → 3 → 5" },
  ],

  // ---- Trees (level-order array form, null = missing child) ----
  "invert-tree": [
    { input: "[4,2,7,1,3,6,9]", output: "[4,7,2,9,6,3,1]" },
  ],
  "max-depth": [
    { input: "[3,9,20,null,null,15,7]", output: "3" },
  ],
  "diameter-tree": [
    { input: "[1,2,3,4,5]", output: "3", explanation: "Path 4 → 2 → 1 → 3 has 3 edges." },
  ],
  "balanced-tree": [
    { input: "[3,9,20,null,null,15,7]", output: "true" },
    { input: "[1,2,2,3,3,null,null,4,4]", output: "false" },
  ],
  "same-tree": [
    { input: "p = [1,2,3], q = [1,2,3]", output: "true" },
  ],
  "subtree-of-another": [
    { input: "root = [3,4,5,1,2], subRoot = [4,1,2]", output: "true" },
  ],
  "lca-bst": [
    { input: "root = [6,2,8,0,4,7,9], p = 2, q = 8", output: "6" },
  ],
  "level-order": [
    { input: "[3,9,20,null,null,15,7]", output: "[[3],[9,20],[15,7]]" },
  ],
  "right-side-view": [
    { input: "[1,2,3,null,5,null,4]", output: "[1,3,4]" },
  ],
  "count-good-nodes": [
    { input: "[3,1,4,3,null,1,5]", output: "4" },
  ],
  "validate-bst": [
    { input: "[2,1,3]", output: "true" },
    { input: "[5,1,4,null,null,3,6]", output: "false" },
  ],
  "kth-smallest-bst": [
    { input: "root = [3,1,4,null,2], k = 1", output: "1" },
  ],
  "build-tree-pre-in": [
    { input: "preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]", output: "[3,9,20,null,null,15,7]" },
  ],
  "max-path-sum": [
    { input: "[-10,9,20,null,null,15,7]", output: "42", explanation: "15 → 20 → 7." },
  ],
  "serialize-deserialize": [
    { input: "[1,2,3,null,null,4,5]", output: "deserialize(serialize(root)) rebuilds the same tree" },
  ],

  // ---- Tries ----
  "implement-trie": [
    { input: 'insert("apple"); search("apple"); search("app"); startsWith("app")', output: "true, false, true" },
  ],
  "add-search-words": [
    { input: 'addWord("bad"); search("b.."); search("b.d")', output: "true, true", explanation: "'.' matches any single letter." },
  ],
  "word-search-ii": [
    { input: 'board of letters, words = ["oath","pea","eat","rain"]', output: '["eat","oath"]' },
  ],

  // ---- Heap / Priority Queue ----
  "kth-largest-stream": [
    { input: "k = 3, [4,5,8,2]; add(3); add(5)", output: "4, then 5" },
  ],
  "last-stone-weight": [
    { input: "stones = [2,7,4,1,8,1]", output: "1" },
  ],
  "k-closest-points": [
    { input: "points = [[1,3],[-2,2]], k = 1", output: "[[-2,2]]" },
  ],
  "kth-largest-array": [
    { input: "nums = [3,2,1,5,6,4], k = 2", output: "5" },
  ],
  "task-scheduler": [
    { input: 'tasks = ["A","A","A","B","B","B"], n = 2', output: "8" },
  ],
  "design-twitter": [
    { input: "postTweet(1,5); follow(1,2); postTweet(2,6); getNewsFeed(1)", output: "[6,5]", explanation: "10 most recent tweets from self + followees." },
  ],
  "median-data-stream": [
    { input: "addNum(1); addNum(2); findMedian(); addNum(3); findMedian()", output: "1.5, then 2" },
  ],

  // ---- Backtracking ----
  "subsets": [
    { input: "nums = [1,2,3]", output: "[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]" },
  ],
  "combination-sum": [
    { input: "candidates = [2,3,6,7], target = 7", output: "[[2,2,3],[7]]" },
  ],
  "permutations": [
    { input: "nums = [1,2,3]", output: "[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]" },
  ],
  "subsets-ii": [
    { input: "nums = [1,2,2]", output: "[[],[1],[1,2],[1,2,2],[2],[2,2]]" },
  ],
  "combination-sum-ii": [
    { input: "candidates = [10,1,2,7,6,1,5], target = 8", output: "[[1,1,6],[1,2,5],[1,7],[2,6]]" },
  ],
  "word-search": [
    { input: 'board = [["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word = "ABCCED"', output: "true" },
  ],
  "palindrome-partitioning": [
    { input: 's = "aab"', output: '[["a","a","b"],["aa","b"]]' },
  ],
  "letter-combinations": [
    { input: 'digits = "23"', output: '["ad","ae","af","bd","be","bf","cd","ce","cf"]' },
  ],
  "n-queens": [
    { input: "n = 4", output: "2 distinct solutions" },
  ],

  // ---- Graphs ----
  "number-of-islands": [
    { input: '[["1","1","0"],["1","0","0"],["0","0","1"]]', output: "2" },
  ],
  "max-area-island": [
    { input: "a grid whose largest island has 6 connected land cells", output: "6" },
  ],
  "clone-graph": [
    { input: "adjList = [[2,4],[1,3],[2,4],[1,3]]", output: "a deep copy of the 4-node graph" },
  ],
  "walls-and-gates": [
    { input: "a grid of gates (0), walls (-1), and empty rooms (INF)", output: "each room filled with its distance to the nearest gate" },
  ],
  "rotting-oranges": [
    { input: "[[2,1,1],[1,1,0],[0,1,1]]", output: "4" },
  ],
  "pacific-atlantic": [
    { input: "a height grid bordered by the Pacific (top/left) and Atlantic (bottom/right)", output: "all cells that can drain to both oceans" },
  ],
  "surrounded-regions": [
    { input: "a board where one O-region touches the border and one is enclosed", output: "only the enclosed region flips to X" },
  ],
  "course-schedule": [
    { input: "numCourses = 2, prerequisites = [[1,0]]", output: "true" },
    { input: "numCourses = 2, prerequisites = [[1,0],[0,1]]", output: "false" },
  ],
  "course-schedule-ii": [
    { input: "numCourses = 2, prerequisites = [[1,0]]", output: "[0,1]" },
  ],
  "graph-valid-tree": [
    { input: "n = 5, edges = [[0,1],[0,2],[0,3],[1,4]]", output: "true" },
  ],
  "connected-components": [
    { input: "n = 5, edges = [[0,1],[1,2],[3,4]]", output: "2" },
  ],
  "redundant-connection": [
    { input: "edges = [[1,2],[1,3],[2,3]]", output: "[2,3]" },
  ],
  "word-ladder": [
    { input: 'beginWord = "hit", endWord = "cog", list = ["hot","dot","dog","lot","log","cog"]', output: "5" },
  ],

  // ---- Advanced Graphs ----
  "reconstruct-itinerary": [
    { input: '[["MUC","LHR"],["JFK","MUC"],["SFO","SJC"],["LHR","SFO"]]', output: '["JFK","MUC","LHR","SFO","SJC"]' },
  ],
  "min-cost-connect-points": [
    { input: "points = [[0,0],[2,2],[3,10],[5,2],[7,0]]", output: "20" },
  ],
  "network-delay-time": [
    { input: "times = [[2,1,1],[2,3,1],[3,4,1]], n = 4, k = 2", output: "2" },
  ],
  "swim-in-water": [
    { input: "grid = [[0,2],[1,3]]", output: "3" },
  ],
  "alien-dictionary": [
    { input: 'words = ["wrt","wrf","er","ett","rftt"]', output: '"wertf"' },
  ],
  "cheapest-flights-k-stops": [
    { input: "n=4, flights=[[0,1,100],[1,2,100],[2,0,100],[1,3,600],[2,3,200]], src=0, dst=3, k=1", output: "700" },
  ],

  // ---- 1-D DP ----
  "climbing-stairs": [
    { input: "n = 3", output: "3", explanation: "1+1+1, 1+2, 2+1." },
  ],
  "min-cost-climbing-stairs": [
    { input: "cost = [10,15,20]", output: "15" },
  ],
  "house-robber": [
    { input: "nums = [2,7,9,3,1]", output: "12", explanation: "Rob houses 2 + 9 + 1." },
  ],
  "house-robber-ii": [
    { input: "nums = [2,3,2]", output: "3", explanation: "Can't rob first and last together." },
  ],
  "longest-palindromic-substring": [
    { input: 's = "babad"', output: '"bab"', explanation: '"aba" is also valid.' },
  ],
  "palindromic-substrings": [
    { input: 's = "aaa"', output: "6" },
  ],
  "decode-ways": [
    { input: 's = "226"', output: "3", explanation: '"2 2 6", "22 6", "2 26".' },
  ],
  "coin-change": [
    { input: "coins = [1,2,5], amount = 11", output: "3", explanation: "5 + 5 + 1." },
  ],
  "max-product-subarray": [
    { input: "nums = [2,3,-2,4]", output: "6", explanation: "[2,3]." },
  ],
  "word-break": [
    { input: 's = "leetcode", wordDict = ["leet","code"]', output: "true" },
  ],
  "longest-increasing-subsequence": [
    { input: "nums = [10,9,2,5,3,7,101,18]", output: "4", explanation: "[2,3,7,101]." },
  ],
  "partition-equal-subset": [
    { input: "nums = [1,5,11,5]", output: "true", explanation: "[1,5,5] and [11]." },
  ],

  // ---- 2-D DP ----
  "unique-paths": [
    { input: "m = 3, n = 7", output: "28" },
  ],
  "longest-common-subsequence": [
    { input: 'text1 = "abcde", text2 = "ace"', output: "3", explanation: '"ace".' },
  ],
  "buy-sell-cooldown": [
    { input: "prices = [1,2,3,0,2]", output: "3" },
  ],
  "coin-change-ii": [
    { input: "amount = 5, coins = [1,2,5]", output: "4" },
  ],
  "target-sum": [
    { input: "nums = [1,1,1,1,1], target = 3", output: "5" },
  ],
  "interleaving-string": [
    { input: 's1 = "aabcc", s2 = "dbbca", s3 = "aadbbcbcac"', output: "true" },
  ],
  "longest-increasing-path": [
    { input: "matrix = [[9,9,4],[6,6,8],[2,1,1]]", output: "4", explanation: "1 → 2 → 6 → 9." },
  ],
  "distinct-subsequences": [
    { input: 's = "rabbbit", t = "rabbit"', output: "3" },
  ],
  "edit-distance": [
    { input: 'word1 = "horse", word2 = "ros"', output: "3" },
  ],
  "burst-balloons": [
    { input: "nums = [3,1,5,8]", output: "167" },
  ],
  "regex-matching": [
    { input: 's = "aa", p = "a*"', output: "true" },
  ],

  // ---- Greedy ----
  "max-subarray": [
    { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6", explanation: "[4,-1,2,1]." },
  ],
  "jump-game": [
    { input: "nums = [2,3,1,1,4]", output: "true" },
    { input: "nums = [3,2,1,0,4]", output: "false" },
  ],
  "jump-game-ii": [
    { input: "nums = [2,3,1,1,4]", output: "2" },
  ],
  "gas-station": [
    { input: "gas = [1,2,3,4,5], cost = [3,4,5,1,2]", output: "3" },
  ],
  "hand-of-straights": [
    { input: "hand = [1,2,3,6,2,3,4,7,8], groupSize = 3", output: "true", explanation: "[1,2,3],[2,3,4],[6,7,8]." },
  ],
  "merge-triplets": [
    { input: "triplets = [[2,5,3],[1,8,4],[1,7,5]], target = [2,7,5]", output: "true" },
  ],
  "partition-labels": [
    { input: 's = "ababcbacadefegdehijhklij"', output: "[9,7,8]" },
  ],
  "valid-parenthesis-string": [
    { input: 's = "(*)"', output: "true" },
    { input: 's = "(*))"', output: "true" },
  ],

  // ---- Intervals ----
  "insert-interval": [
    { input: "intervals = [[1,3],[6,9]], newInterval = [2,5]", output: "[[1,5],[6,9]]" },
  ],
  "merge-intervals": [
    { input: "intervals = [[1,3],[2,6],[8,10],[15,18]]", output: "[[1,6],[8,10],[15,18]]" },
  ],
  "non-overlapping-intervals": [
    { input: "intervals = [[1,2],[2,3],[3,4],[1,3]]", output: "1" },
  ],
  "meeting-rooms": [
    { input: "intervals = [[0,30],[5,10],[15,20]]", output: "false" },
  ],
  "meeting-rooms-ii": [
    { input: "intervals = [[0,30],[5,10],[15,20]]", output: "2" },
  ],
  "min-interval-query": [
    { input: "intervals = [[1,4],[2,4],[3,6],[4,4]], queries = [2,3,4,5]", output: "[3,3,1,4]" },
  ],

  // ---- Math & Geometry ----
  "rotate-image": [
    { input: "[[1,2,3],[4,5,6],[7,8,9]]", output: "[[7,4,1],[8,5,2],[9,6,3]]" },
  ],
  "spiral-matrix": [
    { input: "[[1,2,3],[4,5,6],[7,8,9]]", output: "[1,2,3,6,9,8,7,4,5]" },
  ],
  "set-matrix-zeroes": [
    { input: "[[1,1,1],[1,0,1],[1,1,1]]", output: "[[1,0,1],[0,0,0],[1,0,1]]" },
  ],
  "happy-number": [
    { input: "n = 19", output: "true", explanation: "1²+9²=82 → 8²+2²=68 → … → 1." },
  ],
  "plus-one": [
    { input: "digits = [1,2,3]", output: "[1,2,4]" },
    { input: "digits = [9,9]", output: "[1,0,0]" },
  ],
  "pow-x-n": [
    { input: "x = 2, n = 10", output: "1024" },
    { input: "x = 2, n = -2", output: "0.25" },
  ],
  "multiply-strings": [
    { input: 'num1 = "123", num2 = "456"', output: '"56088"' },
  ],
  "detect-squares": [
    { input: "add([3,10]); add([11,2]); add([3,2]); count([11,10])", output: "1", explanation: "One axis-aligned square uses the four points." },
  ],

  // ---- Bit Manipulation ----
  "single-number": [
    { input: "nums = [4,1,2,1,2]", output: "4" },
  ],
  "number-of-one-bits": [
    { input: "n = 11 (binary 1011)", output: "3" },
  ],
  "counting-bits": [
    { input: "n = 5", output: "[0,1,1,2,1,2]" },
  ],
  "reverse-bits": [
    { input: "the 32-bit number 0000...0101", output: "1010...0000 (bits mirrored)" },
  ],
  "missing-number": [
    { input: "nums = [3,0,1]", output: "2" },
  ],
  "sum-two-integers": [
    { input: "a = 2, b = 3", output: "5" },
  ],
  "reverse-integer": [
    { input: "x = 123", output: "321" },
    { input: "x = -123", output: "-321" },
  ],
};
