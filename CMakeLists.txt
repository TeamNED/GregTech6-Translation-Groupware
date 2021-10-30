cmake_minimum_required(VERSION 3.0.0)
project(GT6TG VERSION 0.1.0)

INCLUDE_DIRECTORIES(
    $ENV{VCPKG_ROOT}/installed/x64-windows/include/
)

LINK_DIRECTORIES(
    "$<$<CONFIG:DEBUG>:$ENV{VCPKG_ROOT}/installed/x64-windows/debug/lib>"
    "$<$<CONFIG:RELEASE>:$ENV{VCPKG_ROOT}/installed/x64-windows/lib>"
)

add_compile_options("$<$<C_COMPILER_ID:MSVC>:/utf-8>")
add_compile_options("$<$<CXX_COMPILER_ID:MSVC>:/utf-8>")
add_executable(GT6TG
  src/main.cpp
  src/ReplacerConfig.cpp

  src/generators/Generator.cpp
  src/generators/DictGenerator.cpp
  src/generators/RuleGenerator.cpp
  src/generators/Rule.cpp

  src/meta/IGeneratorMeta.cpp
  src/meta/GeneratorMeta.cpp

  src/lang_result/ILangResult.cpp
  src/lang_result/LangResult.cpp
  src/lang_result/DictLangResult.cpp
)

TARGET_LINK_LIBRARIES(GT6TG
  ryml 
  c4core 
  debug boost_program_options-vc140-mt-gd optimized boost_program_options-vc140-mt
  debug boost_filesystem-vc140-mt-gd optimized boost_filesystem-vc140-mt
)