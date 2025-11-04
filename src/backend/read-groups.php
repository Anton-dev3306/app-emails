<?php
require_once 'db.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$userEmail = $_GET['user_email'] ?? null;
$groupId = $_GET['group_id'] ?? null;

if (!$userEmail) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email de usuario requerido']);
    exit;
}

$userEmail = filter_var($userEmail, FILTER_SANITIZE_EMAIL);

try {
    if ($groupId) {
        $stmt = $pdo->prepare('
            SELECT
                g.id, g."groupName", g.description, g.color, g."createdAt", g."updatedAt",
                (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) AS newsletter_count
            FROM "NewsletterGroup" g
            WHERE g.id = $1 AND g."userEmail" = $2
        ');
        $stmt->execute([$groupId, $userEmail]);
        $group = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$group) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Grupo no encontrado']);
            exit;
        }

        $stmt = $pdo->prepare('
            SELECT id, "senderEmail", "senderName", "addedAt"
            FROM "NewsletterGroupItem"
            WHERE "groupId" = $1
            ORDER BY "addedAt" DESC
        ');
        $stmt->execute([$groupId]);
        $group['newsletters'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'group' => $group]);
        exit;
    }

    $stmt = $pdo->prepare('
        SELECT
            g.id, g."groupName", g.description, g.color, g."createdAt", g."updatedAt",
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) AS newsletter_count
        FROM "NewsletterGroup" g
        WHERE g."userEmail" = $1
        ORDER BY g."createdAt" DESC
    ');
    $stmt->execute([$userEmail]);
    $groups = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$groups) {
        echo json_encode(['success' => true, 'total' => 0, 'groups' => []]);
        exit;
    }

    $newsletterStmt = $pdo->prepare('
        SELECT id, "senderEmail", "senderName", "addedAt"
        FROM "NewsletterGroupItem"
        WHERE "groupId" = $1
        ORDER BY "addedAt" DESC
    ');

    foreach ($groups as &$group) {
        $newsletterStmt->execute([$group['id']]);
        $group['newsletters'] = $newsletterStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    echo json_encode([
        'success' => true,
        'total' => count($groups),
        'groups' => $groups
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error al obtener grupos: ' . $e->getMessage()
    ]);
}
?>
