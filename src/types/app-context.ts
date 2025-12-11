
export interface User {
    id: string;
    email?: string;
    username?: string;
    [key: string]: any;
}

export interface AuthContext {
    user?: User;
    token?: string;
    [key: string]: any;
}

export interface AppVariables {
    // Generic route variables
    tableName?: string;

    // Auth variables
    auth?: AuthContext;

    // Validation variables
    validatedData?: any;
    validatedQuery?: any;
    validatedParams?: any;

    // Additional context
    [key: string]: any;
}
