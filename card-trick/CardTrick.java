import java.util.*;

/**
 * Simulates a 16-card trick involving 4 aces.
 *
 * Steps:
 *  1. 12 non-ace cards spread face-down; 4 aces inserted face-up at random positions
 *  2. Stack is shuffled
 *  3. Dealt one-by-one: odd positions (1st,3rd,...) no flip; even positions (2nd,4th,...) flipped
 *  4. Dealt in pairs: random choice to flip both cards of each pair or keep them
 *  5. Placed into a 4x4 grid in boustrophedon (snake) order
 *  6. Outer rows/columns folded inward at random until a single stack remains
 */
public class CardTrick {

    static class Card {
        final String name;
        boolean faceUp;

        Card(String name, boolean faceUp) {
            this.name = name;
            this.faceUp = faceUp;
        }

        Card copy() { return new Card(name, faceUp); }
        void flip() { faceUp = !faceUp; }

        @Override
        public String toString() {
            return String.format("%-4s%s", name, faceUp ? "↑" : "↓");
        }
    }

    // grid[row][col] is a stack; index 0 = top card
    @SuppressWarnings("unchecked")
    static List<Card>[][] grid = new List[4][4];
    static int rows = 4, cols = 4;

    public static void main(String[] args) {
        Random rand = new Random();

        // ── Step 1 & 2: Create cards, spread non-aces, insert aces ──────────
        String[] suits     = {"♠","♥","♦","♣"};
        String[] nonAceRanks = {"2","3","4","5","6","7","8","9","10","J","Q","K"};

        List<Card> spread = new ArrayList<>();
        for (int i = 0; i < nonAceRanks.length; i++) {
            spread.add(new Card(nonAceRanks[i] + suits[i % 4], false)); // face down
        }
        for (String suit : suits) {
            spread.add(rand.nextInt(spread.size() + 1), new Card("A" + suit, true)); // face up
        }

        System.out.println("══ Step 2: Spread with aces inserted (↑=face-up, ↓=face-down) ══");
        printList(spread);

        // ── Step 3: Shuffle ──────────────────────────────────────────────────
        Collections.shuffle(spread, rand);
        System.out.println("\n══ Step 3: After shuffle ══");
        printList(spread);

        // ── Step 4: Deal one-by-one, flipping every 2nd card ────────────────
        // Cards are taken from the top of 'spread' (index 0) and placed on top of stack1.
        // Position 1, 3, 5... → no flip.  Position 2, 4, 6... → flip.
        List<Card> stack1 = new ArrayList<>();
        for (int i = 0; i < spread.size(); i++) {
            Card c = spread.get(i).copy();
            if ((i + 1) % 2 == 0) c.flip();
            stack1.add(0, c); // place on top of stack1
        }
        System.out.println("\n══ Step 4: After alternating-flip deal → stack1 ══");
        printList(stack1);

        // ── Step 5: Deal in pairs, random flip choice per pair ───────────────
        // Flipping a pair is a PHYSICAL PACKET FLIP: both cards flip individually
        // AND their order within the pair swaps (bottom card comes to top).
        List<Card> stack2 = new ArrayList<>();
        System.out.println("\n══ Step 5: Pair dealing ══");
        for (int i = 0; i < stack1.size(); i += 2) {
            Card c1 = stack1.get(i).copy();     // top of pair
            Card c2 = stack1.get(i + 1).copy(); // bottom of pair
            boolean flip = rand.nextBoolean();
            System.out.printf("  Pair %d: [%s, %s] → %s%n",
                    (i / 2) + 1, c1, c2, flip ? "FLIPPED" : "kept");
            if (flip) {
                // Packet flip: c2 becomes top (flipped), c1 becomes bottom (flipped)
                c1.flip(); c2.flip();
                stack2.add(0, c2); // c2 goes down first
                stack2.add(0, c1); // c1 ends up on top
            } else {
                // Normal deal: c1 first, c2 on top
                stack2.add(0, c1);
                stack2.add(0, c2); // c2 ends up on top
            }
        }
        System.out.print("  stack2 → ");
        printList(stack2);

        // ── Step 6: Deal into 4×4 grid in boustrophedon (snake) order ────────
        // Row 0: left→right  (positions  1– 4)
        // Row 1: right→left  (positions  5– 8)
        // Row 2: left→right  (positions  9–12)
        // Row 3: right→left  (positions 13–16)
        for (int r = 0; r < 4; r++)
            for (int c = 0; c < 4; c++)
                grid[r][c] = new ArrayList<>();

        int pos = 0;
        for (int r = 0; r < 4; r++) {
            if (r % 2 == 0) {
                for (int c = 0; c < 4; c++) grid[r][c].add(stack2.get(pos++).copy());
            } else {
                for (int c = 3; c >= 0; c--) grid[r][c].add(stack2.get(pos++).copy());
            }
        }
        System.out.println("\n══ Step 6: 4×4 grid (top card | stack depth) ══");
        printGrid();

        // ── Step 7: Fold outer rows/columns inward until 1×1 ─────────────────
        // Available choices depend on remaining dimensions:
        //   rows > 1 → can fold "top" or "bottom"
        //   cols > 1 → can fold "left" or "right"
        // A folded strip is placed face-down on the adjacent inner row/column
        // (each card is flipped; relative order within each cell stack is preserved).
        System.out.println("\n══ Step 7: Folding ══");
        int foldNum = 0;
        while (rows > 1 || cols > 1) {
            List<String> choices = new ArrayList<>();
            if (rows > 1) { choices.add("top"); choices.add("bottom"); }
            if (cols > 1) { choices.add("left"); choices.add("right"); }
            String choice = choices.get(rand.nextInt(choices.size()));
            System.out.printf("%nFold %d: %s%n", ++foldNum, choice.toUpperCase());
            switch (choice) {
                case "top"    -> foldRow(0,        1       );
                case "bottom" -> foldRow(rows - 1, rows - 2);
                case "left"   -> foldCol(0,        1       );
                case "right"  -> foldCol(cols - 1, cols - 2);
            }
            printGrid();
        }

        // ── Final result ──────────────────────────────────────────────────────
        List<Card> finalStack = grid[0][0];
        System.out.println("\n══ Final stack (top → bottom) ══");
        for (int i = 0; i < finalStack.size(); i++) {
            System.out.printf("  %2d: %s%n", i + 1, finalStack.get(i));
        }
        System.out.println("\nAce positions in final stack:");
        for (int i = 0; i < finalStack.size(); i++) {
            Card c = finalStack.get(i);
            if (c.name.startsWith("A")) {
                System.out.printf("  Position %2d: %s%n", i + 1, c);
            }
        }
    }

    // ── Grid operations ───────────────────────────────────────────────────────

    /** Fold srcRow onto dstRow: each card is flipped and the whole sub-stack placed on top. */
    static void foldRow(int srcRow, int dstRow) {
        for (int c = 0; c < cols; c++) {
            List<Card> flipped = flippedCopy(grid[srcRow][c]);
            grid[dstRow][c].addAll(0, flipped);
        }
        removeRow(srcRow);
    }

    /** Fold srcCol onto dstCol: each card is flipped and the whole sub-stack placed on top. */
    static void foldCol(int srcCol, int dstCol) {
        for (int r = 0; r < rows; r++) {
            List<Card> flipped = flippedCopy(grid[r][srcCol]);
            grid[r][dstCol].addAll(0, flipped);
        }
        removeCol(srcCol);
    }

    /** Returns a new list with copies of each card, all flipped, in the same order. */
    static List<Card> flippedCopy(List<Card> src) {
        List<Card> result = new ArrayList<>(src.size());
        for (Card card : src) {
            Card cp = card.copy();
            cp.flip();
            result.add(cp);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    static void removeRow(int row) {
        List<Card>[][] ng = new List[rows - 1][cols];
        int ni = 0;
        for (int i = 0; i < rows; i++) if (i != row) ng[ni++] = grid[i];
        grid = ng;
        rows--;
    }

    @SuppressWarnings("unchecked")
    static void removeCol(int col) {
        List<Card>[][] ng = new List[rows][cols - 1];
        for (int i = 0; i < rows; i++) {
            int nj = 0;
            for (int j = 0; j < cols; j++) if (j != col) ng[i][nj++] = grid[i][j];
        }
        grid = ng;
        cols--;
    }

    // ── Display helpers ───────────────────────────────────────────────────────

    static void printList(List<Card> list) {
        StringBuilder sb = new StringBuilder("  [");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(list.get(i));
        }
        sb.append("]  ← index 0 is top");
        System.out.println(sb);
    }

    static void printGrid() {
        System.out.printf("  Grid %d×%d  (top card | depth)%n", rows, cols);
        for (int r = 0; r < rows; r++) {
            System.out.print("  ");
            for (int c = 0; c < cols; c++) {
                List<Card> cell = grid[r][c];
                String top = cell.isEmpty() ? "---" : cell.get(0).toString();
                System.out.printf("%-14s", "[" + top + "|" + cell.size() + "]");
            }
            System.out.println();
        }
    }
}
