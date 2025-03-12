FROM vastai/base-image:cuda-12.1.1-cudnn8-devel-ubuntu22.04

RUN sudo apt-get update
# Install colamp dependencies 

RUN sudo apt-get install -y  \
    git \
    cmake \
    ninja-build \
    build-essential \
    libboost-program-options-dev \
    libboost-graph-dev \
    libboost-system-dev \
    libeigen3-dev \
    libflann-dev \
    libfreeimage-dev \
    libmetis-dev \
    libgoogle-glog-dev \
    libgtest-dev \
    libgmock-dev \
    libsqlite3-dev \
    libglew-dev \
    qtbase5-dev \
    libqt5opengl5-dev \
    libcgal-dev \
    libceres-dev
    
RUN sudo apt-get install -y gcc-10 g++-10
RUN export CC=/usr/bin/gcc-10
RUN export CXX=/usr/bin/g++-10
RUN export CUDAHOSTCXX=/usr/bin/g++-10

# Clone and compile Colmap 
RUN git clone https://github.com/colmap/colmap.git 
RUN cd colmap && mkdir build && \
    cd build && \
    cmake .. -GNinja -DCMAKE_CUDA_ARCHITECTURES=86 && \
    ninja && \
    ninja install
