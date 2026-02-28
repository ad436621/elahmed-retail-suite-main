// ============================================================
// ELAHMED RETAIL SUITE — OpenAPI/Swagger Documentation
// ============================================================

export const openapiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'ElAhmed Retail Suite API',
        description: `
## Authentication
All endpoints require authentication via Bearer token or httpOnly cookie.

### Authorization Header
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

### Roles
- **owner**: Full system access
- **admin**: Administrative functions
- **employee**: Basic sales and inventory operations
    `,
        version: '1.0.0',
        contact: {
            name: 'ElAhmed Retail Support',
        },
    },
    servers: [
        {
            url: 'http://localhost:3000',
            description: 'Development server',
        },
        {
            url: 'https://api.elahmed-retail.com',
            description: 'Production server',
        },
    ],
    tags: [
        { name: 'Auth', description: 'Authentication endpoints' },
        { name: 'Users', description: 'User management' },
        { name: 'Products', description: 'Product management' },
        { name: 'Sales', description: 'Sales operations' },
        { name: 'Inventory', description: 'Stock management' },
        { name: 'Customers', description: 'Customer CRM' },
        { name: 'Suppliers', description: 'Supplier management' },
        { name: 'Settings', description: 'System settings' },
    ],
    paths: {
        '/api/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'User login',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['username', 'password'],
                                properties: {
                                    username: { type: 'string' },
                                    password: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        token: { type: 'string' },
                                        user: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                    '401': { description: 'Invalid credentials' },
                },
            },
        },
        '/api/products': {
            get: {
                tags: ['Products'],
                summary: 'Get all products',
                parameters: [
                    {
                        name: 'category',
                        in: 'query',
                        schema: { type: 'string' },
                    },
                    {
                        name: 'search',
                        in: 'query',
                        schema: { type: 'string' },
                    },
                    {
                        name: 'page',
                        in: 'query',
                        schema: { type: 'integer', default: 1 },
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', default: 50 },
                    },
                ],
                responses: {
                    '200': {
                        description: 'Product list',
                    },
                },
            },
            post: {
                tags: ['Products'],
                summary: 'Create product',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'barcode', 'category', 'costPrice', 'sellingPrice'],
                                properties: {
                                    name: { type: 'string' },
                                    barcode: { type: 'string' },
                                    category: { type: 'string' },
                                    costPrice: { type: 'number' },
                                    sellingPrice: { type: 'number' },
                                    quantity: { type: 'integer' },
                                    supplier: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': { description: 'Product created' },
                    '400': { description: 'Validation error' },
                },
            },
        },
        '/api/products/{id}': {
            get: {
                tags: ['Products'],
                summary: 'Get product by ID',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    '200': { description: 'Product details' },
                    '404': { description: 'Product not found' },
                },
            },
            put: {
                tags: ['Products'],
                summary: 'Update product',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                responses: {
                    '200': { description: 'Product updated' },
                },
            },
            delete: {
                tags: ['Products'],
                summary: 'Delete product (soft delete)',
                security: [{ bearerAuth: [] }],
                responses: {
                    '204': { description: 'Product deleted' },
                },
            },
        },
        '/api/sales': {
            get: {
                tags: ['Sales'],
                summary: 'Get all sales',
                parameters: [
                    {
                        name: 'startDate',
                        in: 'query',
                        schema: { type: 'string', format: 'date' },
                    },
                    {
                        name: 'endDate',
                        in: 'query',
                        schema: { type: 'string', format: 'date' },
                    },
                    {
                        name: 'paymentMethod',
                        in: 'query',
                        schema: { type: 'string', enum: ['cash', 'card', 'split'] },
                    },
                ],
                responses: {
                    '200': { description: 'Sales list' },
                },
            },
            post: {
                tags: ['Sales'],
                summary: 'Create new sale',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['items'],
                                properties: {
                                    items: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                productId: { type: 'string' },
                                                qty: { type: 'integer' },
                                                discount: { type: 'number' },
                                            },
                                        },
                                    },
                                    discount: { type: 'number' },
                                    paymentMethod: { type: 'string', enum: ['cash', 'card', 'split'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': { description: 'Sale created' },
                    '400': { description: 'Insufficient stock or validation error' },
                },
            },
        },
        '/api/sales/{id}/void': {
            post: {
                tags: ['Sales'],
                summary: 'Void a sale',
                security: [{ bearerAuth: [] }],
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        schema: { type: 'string', format: 'uuid' },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['reason'],
                                properties: {
                                    reason: { type: 'string', minLength: 10 },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Sale voided' },
                    '400': { description: 'Cannot void sale' },
                },
            },
        },
        '/api/customers': {
            get: {
                tags: ['Customers'],
                summary: 'Get all customers',
                responses: {
                    '200': { description: 'Customer list' },
                },
            },
            post: {
                tags: ['Customers'],
                summary: 'Create customer',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                    name: { type: 'string' },
                                    phone: { type: 'string' },
                                    email: { type: 'string' },
                                    address: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '201': { description: 'Customer created' },
                },
            },
        },
        '/api/suppliers': {
            get: {
                tags: ['Suppliers'],
                summary: 'Get all suppliers',
                responses: {
                    '200': { description: 'Supplier list' },
                },
            },
            post: {
                tags: ['Suppliers'],
                summary: 'Create supplier',
                security: [{ bearerAuth: [] }],
                responses: {
                    '201': { description: 'Supplier created' },
                },
            },
        },
        '/api/suppliers/orders': {
            get: {
                tags: ['Suppliers'],
                summary: 'Get purchase orders',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': { description: 'Purchase order list' },
                },
            },
            post: {
                tags: ['Suppliers'],
                summary: 'Create purchase order',
                security: [{ bearerAuth: [] }],
                responses: {
                    '201': { description: 'Purchase order created' },
                },
            },
        },
        '/api/inventory/summary': {
            get: {
                tags: ['Inventory'],
                summary: 'Get inventory summary',
                responses: {
                    '200': { description: 'Inventory summary' },
                },
            },
        },
        '/api/inventory/adjust': {
            post: {
                tags: ['Inventory'],
                summary: 'Adjust stock',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['productId', 'quantity', 'reason'],
                                properties: {
                                    productId: { type: 'string' },
                                    quantity: { type: 'integer' },
                                    reason: { type: 'string' },
                                    type: { type: 'string', enum: ['manual_adjustment', 'correction', 'damaged', 'found'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Stock adjusted' },
                },
            },
        },
        '/api/settings/tax': {
            get: {
                tags: ['Settings'],
                summary: 'Get tax settings',
            },
            put: {
                tags: ['Settings'],
                summary: 'Update tax settings',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    enabled: { type: 'boolean' },
                                    rate: { type: 'number' },
                                    taxNumber: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'Settings updated' },
                },
            },
        },
        '/api/settings/branches': {
            get: {
                tags: ['Settings'],
                summary: 'Get branches',
            },
            post: {
                tags: ['Settings'],
                summary: 'Create branch',
                security: [{ bearerAuth: [] }],
                responses: {
                    '201': { description: 'Branch created' },
                },
            },
        },
        '/api/users': {
            get: {
                tags: ['Users'],
                summary: 'Get all users',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': { description: 'User list' },
                },
            },
            post: {
                tags: ['Users'],
                summary: 'Create user',
                security: [{ bearerAuth: [] }],
                responses: {
                    '201': { description: 'User created' },
                },
            },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    details: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                field: { type: 'string' },
                                message: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    },
};

export default openapiSpec;
