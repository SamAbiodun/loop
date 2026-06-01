export type Difficulty = "Easy" | "Medium" | "Hard";

export type Problem = {
  id: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  statement: string;
  constraints: string[];
  targetComplexity: string;
  starterCode: string;
};

export const PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    category: "Arrays & Hashing",
    statement:
      "Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`. Each input has exactly one solution, and you may not use the same element twice.",
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "Exactly one valid answer exists.",
    ],
    targetComplexity: "O(n) time, O(n) space",
    starterCode: `function twoSum(nums: number[], target: number): number[] {

}`,
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    category: "Stacks",
    statement:
      "Given a string `s` containing just the characters '()[]{}', determine if the input string is valid. Brackets must close in the correct order and every closing bracket must match the most recent unclosed opening bracket.",
    constraints: ["1 <= s.length <= 10^4", "s consists only of the characters '()[]{}'."],
    targetComplexity: "O(n) time, O(n) space",
    starterCode: `function isValid(s: string): boolean {

}`,
  },
  {
    id: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "Easy",
    category: "Linked Lists",
    statement:
      "Given the `head` of a singly linked list, reverse the list and return the new head. Aim for an in-place, iterative solution before considering recursion.",
    constraints: [
      "The number of nodes is in the range [0, 5000].",
      "-5000 <= Node.val <= 5000",
    ],
    targetComplexity: "O(n) time, O(1) space",
    starterCode: `class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val = 0, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

function reverseList(head: ListNode | null): ListNode | null {

}`,
  },
  {
    id: "max-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    category: "Dynamic Programming",
    statement:
      "Given an integer array `nums`, find the contiguous subarray with the largest sum and return that sum. The subarray must contain at least one element.",
    constraints: ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
    targetComplexity: "O(n) time, O(1) space (Kadane's algorithm)",
    starterCode: `function maxSubArray(nums: number[]): number {

}`,
  },
  {
    id: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    category: "Graphs",
    statement:
      "Given an `m x n` 2D grid of '1' (land) and '0' (water), return the number of islands. An island is surrounded by water and formed by connecting adjacent land cells horizontally or vertically.",
    constraints: [
      "m == grid.length, n == grid[i].length",
      "1 <= m, n <= 300",
      "grid[i][j] is '0' or '1'.",
    ],
    targetComplexity: "O(m·n) time, O(m·n) space worst case",
    starterCode: `function numIslands(grid: string[][]): number {

}`,
  },
];
