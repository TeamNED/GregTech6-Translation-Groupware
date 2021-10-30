#ifndef LANGRESULT_H
#define LANGRESULT_H
#pragma once

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

#include "../meta/IGeneratorMeta.hpp"
#include "ILangResult.hpp"

using std::shared_ptr;
using std::string;
using std::unordered_map;
class LangResult : public virtual ILangResult {
private:
  shared_ptr<IGeneratorMeta> _meta;

public:
  LangResult() = default;
  LangResult(shared_ptr<IGeneratorMeta> meta);
  LangResult(const LangResult &) = default;
  LangResult(LangResult &&) = default;
  LangResult &operator=(const LangResult &) = default;
  LangResult &operator=(LangResult &&) = default;
  virtual ~LangResult() = default;
  virtual shared_ptr<IGeneratorMeta> meta() override;
};
#endif