package Mapa;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.HashSet;
import java.util.Set;

import org.junit.Test;

public class MapaTest {

    @Test
    public void everyMapHasThirtyDistinctSpawnPointsAndNoObjectOnThem() {
        for (int i = 0; i < 500; i++) {
            Mapa mapa = new Mapa(20, 20, 100);
            mapa.generiraj();

            Set<String> spawnCells = new HashSet<String>();
            for (Koordinati k : mapa.igraci_pozicii) {
                spawnCells.add(k.x + "," + k.z);
            }
            assertEquals(30, mapa.igraci_pozicii.size());
            assertEquals(30, spawnCells.size());
            assertEquals(100, mapa.lista_objekti.size());
            for (Koordinati k : mapa.lista_objekti) {
                assertTrue(!spawnCells.contains(k.x + "," + k.z));
            }
        }
    }

    @Test
    public void mapSmallerThanThirtyCellsStillGenerates() {
        Mapa mapa = new Mapa(4, 4, 0);
        mapa.generiraj();
        assertEquals(16, mapa.igraci_pozicii.size());
    }
}
