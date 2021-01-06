interface Column {
    displayed: boolean;
    title: string;
    type: number;
    field: string;
    occurence: number;
}

interface Message<T> {
    type: string;
    body: T;
}
