import java.util.*;

public class CardTrickTest {

    static class Card {
        final String name;
        boolean faceUp;
        Card(String name, boolean faceUp) { this.name = name; this.faceUp = faceUp; }
        Card copy() { return new Card(name, faceUp); }
        void flip() { faceUp = !faceUp; }
    }

    @SuppressWarnings("unchecked")
    static List<Card>[][] grid;
    static int rows, cols;

    public static void main(String[] args) {
        int N = 100;
        int successes = 0;

        for (int t = 0; t < N; t++) {
            List<Card> finalStack = simulate(new Random());
            boolean ok = checkInvariant(finalStack);
            if (ok) successes++;
            System.out.printf("Run %3d: %s%n", t + 1, ok ? "PASS" : "FAIL");
        }

        System.out.printf("%n%d / %d passed (%.0f%%)%n", successes, N, successes * 100.0 / N);
    }

    @SuppressWarnings("unchecked")
    static List<Card> simulate(Random rand) {
        String[] suits = {"S","H","D","C"};
        String[] nonAceRanks = {"2","3","4","5","6","7","8","9","10","J","Q","K"};

        // Steps 1+2: non-aces face-down, aces face-up inserted at random positions
        List<Card> spread = new ArrayList<>();
        for (int i = 0; i < nonAceRanks.length; i++)
            spread.add(new Card(nonAceRanks[i] + suits[i % 4], false));
        for (String suit : suits)
            spread.add(rand.nextInt(spread.size() + 1), new Card("A" + suit, true));

        // Step 3: shuffle
        Collections.shuffle(spread, rand);

        // Step 4: deal one-by-one, flip every 2nd card
        List<Card> stack1 = new ArrayList<>();
        for (int i = 0; i < spread.size(); i++) {
            Card c = spread.get(i).copy();
            if ((i + 1) % 2 == 0) c.flip();
            stack1.add(0, c);
        }

        // Step 5: deal in pairs; random flip = physical packet flip (order swaps + each card flips)
        List<Card> stack2 = new ArrayList<>();
        for (int i = 0; i < stack1.size(); i += 2) {
            Card c1 = stack1.get(i).copy();
            Card c2 = stack1.get(i + 1).copy();
            boolean flip = rand.nextBoolean();
            if (flip) {
                c1.flip(); c2.flip();
                stack2.add(0, c2);
                stack2.add(0, c1); // c1 on top after physical packet flip
            } else {
                stack2.add(0, c1);
                stack2.add(0, c2); // c2 on top after normal deal
            }
        }

        // Step 6: 4x4 grid in boustrophedon order
        rows = 4; cols = 4;
        grid = new List[4][4];
        for (int r = 0; r < 4; r++)
            for (int c = 0; c < 4; c++)
                grid[r][c] = new ArrayList<>();
        int pos = 0;
        for (int r = 0; r < 4; r++) {
            if (r % 2 == 0) for (int c = 0; c < 4; c++)  grid[r][c].add(stack2.get(pos++).copy());
            else             for (int c = 3; c >= 0; c--) grid[r][c].add(stack2.get(pos++).copy());
        }

        // Step 7: fold outer rows/columns until 1x1
        while (rows > 1 || cols > 1) {
            List<String> choices = new ArrayList<>();
            if (rows > 1) { choices.add("top"); choices.add("bottom"); }
            if (cols > 1) { choices.add("left"); choices.add("right"); }
            switch (choices.get(rand.nextInt(choices.size()))) {
                case "top"    -> foldRow(0,        1       );
                case "bottom" -> foldRow(rows - 1, rows - 2);
                case "left"   -> foldCol(0,        1       );
                case "right"  -> foldCol(cols - 1, cols - 2);
            }
        }
        return grid[0][0];
    }

    static boolean checkInvariant(List<Card> stack) {
        Boolean aceOri = null, nonAceOri = null;
        for (Card c : stack) {
            if (c.name.startsWith("A")) {
                if (aceOri == null) aceOri = c.faceUp;
                else if (aceOri != c.faceUp) return false;
            } else {
                if (nonAceOri == null) nonAceOri = c.faceUp;
                else if (nonAceOri != c.faceUp) return false;
            }
        }
        return aceOri != null && nonAceOri != null && !aceOri.equals(nonAceOri);
    }

    static void foldRow(int src, int dst) {
        for (int c = 0; c < cols; c++) {
            grid[dst][c].addAll(0, flippedCopy(grid[src][c]));
        }
        removeRow(src);
    }
    static void foldCol(int src, int dst) {
        for (int r = 0; r < rows; r++) {
            grid[r][dst].addAll(0, flippedCopy(grid[r][src]));
        }
        removeCol(src);
    }
    static List<Card> flippedCopy(List<Card> src) {
        List<Card> r = new ArrayList<>();
        for (Card c : src) { Card cp = c.copy(); cp.flip(); r.add(cp); }
        return r;
    }
    @SuppressWarnings("unchecked")
    static void removeRow(int row) {
        List<Card>[][] ng = new List[rows-1][cols];
        int ni = 0;
        for (int i = 0; i < rows; i++) if (i != row) ng[ni++] = grid[i];
        grid = ng; rows--;
    }
    @SuppressWarnings("unchecked")
    static void removeCol(int col) {
        List<Card>[][] ng = new List[rows][cols-1];
        for (int i = 0; i < rows; i++) {
            int nj = 0;
            for (int j = 0; j < cols; j++) if (j != col) ng[i][nj++] = grid[i][j];
        }
        grid = ng; cols--;
    }
}
