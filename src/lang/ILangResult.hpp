#ifndef ILANGRESULT_H
#define ILANGRESULT_H
#pragma once

#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "../meta/IGeneratorMeta.hpp"

using std::shared_ptr;
using std::string;
using std::vector;

using LangItem = std::pair<string, string>;
using LangList = vector<LangItem>;
using LangListPointer = shared_ptr<LangList>;

class ILangResult {
private:
public:
  virtual shared_ptr<IGeneratorMeta> meta() const = 0;
  virtual LangListPointer result() const = 0;
  virtual ~ILangResult() = default;
  virtual bool empty() const = 0;
  explicit operator bool() const;
};
#endif