cmake_minimum_required(VERSION 3.0.0)
project(GT6TG VERSION 0.1.0)

INCLUDE_DIRECTORIES(
    $ENV{VCPKG_ROOT}/installed/x64-windows/include/
)

add_compile_options("$<$<C_COMPILER_ID:MSVC>:/utf-8>")
add_compile_options("$<$<CXX_COMPILER_ID:MSVC>:/utf-8>")

FIND_PACKAGE(ryml CONFIG REQUIRED)
FIND_PACKAGE(fmt CONFIG REQUIRED)
FIND_PACKAGE(Boost REQUIRED COMPONENTS filesystem)
FIND_PACKAGE(Boost REQUIRED COMPONENTS program_options)

add_executable(GT6TG
  src/main.cpp
  src/Replacer.cpp
  src/generator/Generator.cpp
  src/generator/DictGenerator.cpp
  src/generator/RuleGenerator.cpp
  src/generator/Rule.cpp
  src/meta/IGeneratorMeta.cpp
  src/meta/GeneratorMeta.cpp
  src/meta/IGroupRepository.cpp
  src/lang/ILangResult.cpp
  src/lang/LangResult.cpp
  src/lang/DictLangResult.cpp
  src/lang/RuleLangResult.cpp
  src/lang/LangFile.cpp
  src/config/Config.cpp
  src/config/ConfigParser.cpp
  src/config/RuntimeOptions.cpp
)

TARGET_LINK_LIBRARIES(GT6TG
  PRIVATE
  ryml::ryml
  fmt::fmt
  Boost::filesystem
  Boost::program_options
)