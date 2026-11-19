package Server;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import Mapa.Koordinati;
import Mapa.Mapa;
import Mapa.mapaDATA;
import Player.*;

import com.esotericsoftware.kryonet.Client;
import com.esotericsoftware.kryonet.Connection;
import com.esotericsoftware.kryonet.Listener;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.After;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

public class ServerProgramTest {

    private final List<Client> clients = new ArrayList<Client>();

    @BeforeClass
    public static void startServer() {
        assertTrue(ServerProgram.start());
    }

    @AfterClass
    public static void stopServer() {
        ServerProgram.server.stop();
    }

    @After
    public void disconnectClients() throws InterruptedException {
        for (Client client : clients) {
            client.stop();
        }
        long deadline = System.currentTimeMillis() + 3000;
        while (!ServerProgram.players.isEmpty() && System.currentTimeMillis() < deadline) {
            Thread.sleep(20);
        }
    }

    @Test
    public void validCatchUpdatesBothScores() throws Exception {
        TestClient chaser = connect();
        TestClient runner = connect();

        chaser.client.sendTCP(faten(runner.id(), -1, chaser.id(), 2));

        Faten result = runner.next(Faten.class);
        assertEquals(-1, result.id_score);
        assertEquals(2, result.id2_score);
    }

    @Test
    public void inventedScoresAreIgnored() throws Exception {
        TestClient cheater = connect();
        TestClient victim = connect();

        cheater.client.sendTCP(faten(victim.id(), -7, cheater.id(), 1000000));

        assertNull(victim.poll(Faten.class, 500));
        assertEquals(0, ServerProgram.players.get(cheater.id()).score);
        assertEquals(0, ServerProgram.players.get(victim.id()).score);
    }

    @Test
    public void catchBetweenTwoOtherPlayersIsIgnored() throws Exception {
        TestClient cheater = connect();
        TestClient first = connect();
        TestClient second = connect();

        cheater.client.sendTCP(faten(first.id(), -2, second.id(), -2));

        assertNull(first.poll(Faten.class, 500));
        assertEquals(0, ServerProgram.players.get(first.id()).score);
        assertEquals(0, ServerProgram.players.get(second.id()).score);
    }

    @Test
    public void catchNamingUnknownPlayerDoesNotStopTheServer() throws Exception {
        TestClient sender = connect();

        sender.client.sendTCP(faten(9999, -2, sender.id(), -2));
        Thread.sleep(500);

        assertTrue(sender.client.isConnected());
        TestClient late = connect();
        assertTrue(late.client.isConnected());
    }

    @Test
    public void nonFinitePositionIsNotRelayed() throws Exception {
        TestClient sender = connect();
        TestClient receiver = connect();

        PacketUpdateX bad = new PacketUpdateX();
        bad.x = Float.NaN;
        sender.client.sendTCP(bad);
        PacketUpdateX good = new PacketUpdateX();
        good.x = 3.5f;
        sender.client.sendTCP(good);

        PacketUpdateX relayed = receiver.next(PacketUpdateX.class);
        assertEquals(3.5f, relayed.x, 0f);
        assertEquals(sender.id(), relayed.id);
    }

    @Test
    public void startReportsFailureWhenThePortIsTaken() {
        com.esotericsoftware.kryonet.Server running = ServerProgram.server;
        try {
            assertFalse(ServerProgram.start());
        } finally {
            ServerProgram.server = running;
        }
    }

    private static Faten faten(int id, int idScore, int id2, int id2Score) {
        Faten packet = new Faten();
        packet.id = id;
        packet.id_score = idScore;
        packet.id2 = id2;
        packet.id2_score = id2Score;
        return packet;
    }

    private TestClient connect() throws Exception {
        TestClient testClient = new TestClient();
        clients.add(testClient.client);
        testClient.client.start();
        testClient.client.connect(3000, "localhost", ServerProgram.port, ServerProgram.port);
        assertNotNull(testClient.next(Mapa.class));
        return testClient;
    }

    private static class TestClient extends Listener {
        final Client client = new Client(5000, 5000);
        private final BlockingQueue<Object> received = new LinkedBlockingQueue<Object>();

        TestClient() {
            Class<?>[] types = { PacketUpdateX.class, PacketUpdateY.class, PacketUpdateZ.class,
                    PacketUpdateCamPitch.class, PacketUpdateCamYaw.class, Chase.class, Nickname.class, Faten.class,
                    PlayerID.class, PacketAddPlayer.class, PacketRemovePlayer.class, Koordinati.class, Mapa.class,
                    mapaDATA.class, ArrayList.class, int[][].class, int[].class };
            for (Class<?> type : types) {
                client.getKryo().register(type);
            }
            client.addListener(this);
        }

        int id() {
            return client.getID();
        }

        @Override
        public void received(Connection c, Object o) {
            received.add(o);
        }

        <T> T next(Class<T> type) throws InterruptedException {
            T packet = poll(type, 3000);
            assertNotNull("No " + type.getSimpleName() + " received", packet);
            return packet;
        }

        <T> T poll(Class<T> type, long timeoutMillis) throws InterruptedException {
            long deadline = System.currentTimeMillis() + timeoutMillis;
            while (true) {
                long left = deadline - System.currentTimeMillis();
                if (left <= 0) {
                    return null;
                }
                Object o = received.poll(left, TimeUnit.MILLISECONDS);
                if (type.isInstance(o)) {
                    return type.cast(o);
                }
            }
        }
    }
}
