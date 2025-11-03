const Container = ({ children, maxWidth = 'max-w-7xl' }) => {
    return (
        <div className={`${maxWidth} mx-auto px-4 sm:px-6 lg:px-8`}>
            {children}
        </div>
    );
};

export default Container;