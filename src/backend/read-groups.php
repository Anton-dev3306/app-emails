<?php
// read-groups.php
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método no permitido']);
    exit;
}

$userEmail = $_GET['user_email'] ?? null;
$groupId = $_GET['group_id'] ?? null;

if (empty($userEmail)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Email de usuario requerido'
    ]);
    exit;
}

try {
    // Si se solicita un grupo específico
    if ($groupId) {
        $stmt = $pdo->prepare('
            SELECT
                g.*,
                (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) as newsletter_count
            FROM "NewsletterGroup" g
            WHERE g.id = $1 AND g."userEmail" = $2
        ');
        $stmt->execute([$groupId, $userEmail]);
        $group = $stmt->fetch();

        if (!$group) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'Grupo no encontrado'
            ]);
            exit;
        }

        // Obtener newsletters del grupo
        $stmt = $pdo->prepare('
            SELECT * FROM "NewsletterGroupItem"
            WHERE "groupId" = $1
            ORDER BY "addedAt" DESC
        ');
        $stmt->execute([$groupId]);
        $group['newsletters'] = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'group' => $group
        ]);
        exit;
    }

    // Obtener todos los grupos del usuario
    $stmt = $pdo->prepare('
        SELECT
            g.*,
            (SELECT COUNT(*) FROM "NewsletterGroupItem" WHERE "groupId" = g.id) as newsletter_count
        FROM "NewsletterGroup" g
        WHERE g."userEmail" = $1
        ORDER BY g."createdAt" DESC
    ');
    $stmt->execute([$userEmail]);
    $groups = $stmt->fetchAll();

    // Para cada grupo, obtener sus newsletters
    foreach ($groups as &$group) {
        $stmt = $pdo->prepare('
            SELECT * FROM "NewsletterGroupItem"
            WHERE "groupId" = $1
            ORDER BY "addedAt" DESC
        ');
        $stmt->execute([$group['id']]);
        $group['newsletters'] = $stmt->fetchAll();
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