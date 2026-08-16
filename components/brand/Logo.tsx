export default function Logo({
    className = "w-8 h-8",
    showText = true,
    vertical = false,
    textColor = "text-gray-900"
}: {
    className?: string,
    showText?: boolean,
    vertical?: boolean,
    textColor?: string
}) {
    return (
        <div className={`flex items-center gap-3 ${vertical ? 'flex-col gap-2' : ''}`}>
            <svg
                className={className}
                viewBox="0 0 256 256"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <rect width="256" height="256" rx="60" fill="#136dec" />

                <g transform="rotate(-45 128 128)">
                    <path d="M80 80H176" stroke="white" strokeWidth="20" strokeLinecap="round" />
                    <path d="M80 128H144" stroke="white" strokeWidth="20" strokeLinecap="round" />
                    <path d="M80 176H176" stroke="white" strokeWidth="20" strokeLinecap="round" />

                    <circle cx="176" cy="128" r="18" fill="#15803d" />
                </g>
            </svg>
            {showText && (
                <span className={`text-2xl font-bold tracking-tight ${textColor}`}>ETHOS</span>
            )}
        </div>
    )
}